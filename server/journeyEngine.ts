import { listAutomations, findContact, enqueueAutomationJob, now } from "./db.js";
import { randomUUID } from "node:crypto";
import type { Automation, JourneyNode, Contact } from "../src/types.js";
import betterSqlite3 from "better-sqlite3";
import { resolve } from "node:path";

const dbPath = resolve(process.cwd(), "data", "whatsapp-center.sqlite");
const db = new betterSqlite3(dbPath);

export async function processJourneys() {
  const automations = listAutomations().filter(a => a.isActive && a.version === 'journey');
  
  for (const automation of automations) {
    if (!automation.flowData) continue;
    
    // Process due instances
    const dueInstances = db.prepare(`
      select * from journey_instances 
      where automation_id = ? and status = 'active' and next_execution_at <= ?
    `).all(automation.id, now()) as any[];

    for (const instance of dueInstances) {
      await processInstanceStep(automation, instance);
    }
  }
}

async function processInstanceStep(automation: Automation, instance: any) {
  const nodes = automation.flowData!;
  const currentNode = nodes.find(n => n.id === instance.current_node_id);
  const contact = findContact(instance.contact_id);

  if (!currentNode || !contact) {
    markInstanceStatus(instance.id, "completed");
    return;
  }

  // Logic based on category
  let nextNodeId: string | null = null;

  switch (currentNode.category) {
    case "trigger":
      nextNodeId = currentNode.nextId || null;
      break;
    
    case "action":
      await executeAction(currentNode, contact);
      nextNodeId = currentNode.nextId || null;
      break;
    
    case "condition":
      const result = await checkCondition(currentNode, contact);
      nextNodeId = result ? (currentNode.yesId || null) : (currentNode.noId || null);
      break;
    
    case "control":
      if (currentNode.type === 'time_delay') {
         // Logic for delays is handled when scheduling the NEXT step
         nextNodeId = currentNode.nextId || null;
      } else if (currentNode.type === 'exit_journey') {
         markInstanceStatus(instance.id, "completed");
         return;
      }
      break;
  }

  if (nextNodeId) {
    const nextNode = nodes.find(n => n.id === nextNodeId);
    let delayMinutes = 0;
    if (nextNode?.type === 'time_delay') {
       delayMinutes = nextNode.config.minutes || 0;
       // Skip the delay node itself and move to its nextId
       nextNodeId = nextNode.nextId || null;
    }

    const nextExecutionAt = new Date(Date.now() + delayMinutes * 60000).toISOString();
    if (nextNodeId) {
      updateInstance(instance.id, nextNodeId, nextExecutionAt);
    } else {
      markInstanceStatus(instance.id, "completed");
    }
  } else {
    markInstanceStatus(instance.id, "completed");
  }
}

async function executeAction(node: JourneyNode, contact: Contact) {
  console.log(`Executing action ${node.type} for contact ${contact.firstName}`);
  if (node.type === 'send_whatsapp' || node.type === 'send_generic_message') {
    if (node.config.templateId && node.config.channelId) {
       enqueueAutomationJob({
         automationId: node.id, // using node id as ref
         contactId: contact.id,
         channelId: node.config.channelId,
         runAt: now(),
         payload: { templateId: node.config.templateId }
       });
    }
  }
}

async function checkCondition(node: JourneyNode, contact: Contact): Promise<boolean> {
  if (node.type === 'is_in_segment') {
     return contact.segmentIds.includes(node.config.segmentId);
  }
  return false;
}

function updateInstance(id: string, nodeId: string, nextAt: string) {
  db.prepare(`update journey_instances set current_node_id = ?, next_execution_at = ? where id = ?`).run(nodeId, nextAt, id);
}

function markInstanceStatus(id: string, status: string) {
  db.prepare(`update journey_instances set status = ? where id = ?`).run(status, id);
}

export function enrollContact(automationId: string, contactId: string) {
  const automation = listAutomations().find(a => a.id === automationId);
  if (!automation || !automation.flowData || automation.version !== 'journey') return;

  const startNode = automation.flowData[0];
  if (!startNode || startNode.category !== 'trigger') return;

  // Check if already enrolled
  const existing = db.prepare(`select id from journey_instances where automation_id = ? and contact_id = ? and status = 'active'`).get(automationId, contactId);
  if (existing) return;

  db.prepare(`
    insert into journey_instances (id, automation_id, contact_id, current_node_id, next_execution_at, status, created_at)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), automationId, contactId, startNode.id, now(), 'active', now());
}
