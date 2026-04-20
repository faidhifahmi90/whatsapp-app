import { useState } from "react";
import type { JourneyNode, JourneyNodeCategory, BootstrapData } from "../types";

// Node definitions based on requirements
const Palettes: Record<JourneyNodeCategory, { label: string; icon: string; color: string; items: any[] }> = {
  trigger: {
    label: "Triggers",
    icon: "bolt",
    color: "bg-emerald-500",
    items: [
      { type: 'email_activity', label: 'Email activity', icon: 'mark_email_read' },
      { type: 'segment_joined', label: 'Segment joined', icon: 'segment' },
      { type: 'new_contact', label: 'New contact', icon: 'person_add' },
      { type: 'removed_from_segment', label: 'Removed from segment', icon: 'layers_clear' },
      { type: 'page_visit', label: 'Page visit', icon: 'visibility' },
      { type: 'event_performed', label: 'On Event Performed', icon: 'bolt' },
      { type: 'submitted_landing_page', label: 'Submitted from landing page', icon: 'web' },
      { type: 'form_submitted_fb', label: 'Form submitted from FB', icon: 'facebook' }
    ]
  },
  action: {
    label: "Actions",
    icon: "play_arrow",
    color: "bg-sky-500",
    items: [
      { type: 'send_whatsapp', label: 'Send WhatsApp message', icon: 'chat' },
      { type: 'send_email', label: 'Send email', icon: 'alternate_email' }
    ]
  },
  condition: {
    label: "Conditions",
    icon: "help",
    color: "bg-amber-500",
    items: [
      { type: 'is_in_segment', label: 'Is in segment', icon: 'segment' },
      { type: 'check_email_activity', label: 'Check email activity', icon: 'contact_mail' },
      { type: 'check_contact_field', label: 'Check contact field', icon: 'edit_note' },
      { type: 'check_event_performed', label: 'Check event performed', icon: 'event' },
      { type: 'check_page_visited', label: 'Check page visited', icon: 'pageview' },
      { type: 'check_call_activity', label: 'Check call activity', icon: 'call' },
      { type: 'check_submitted_landing', label: 'Submitted from landing page', icon: 'web' },
      { type: 'check_form_fb', label: 'Form submitted from FB', icon: 'facebook' }
    ]
  },
  control: {
    label: "Controls",
    icon: "settings",
    color: "bg-rose-500",
    items: [
      { type: 'time_delay', label: 'Add a time delay', icon: 'timer' },
      { type: 'delay_by_field', label: 'Add delay by contact date field', icon: 'event_repeat' },
      { type: 'wait_for_event', label: 'Wait for custom event', icon: 'schedule' },
      { type: 'delay_by_event', label: 'Add delay by event', icon: 'schedule' },
      { type: 'split_traffic', label: 'Split Traffic', icon: 'call_split' },
      { type: 'exit_journey', label: 'Exit Journey', icon: 'exit_to_app' }
    ]
  }
};

export default function JourneyDesigner(props: {
  nodes: JourneyNode[];
  onSave: (nodes: JourneyNode[]) => void;
  onCancel: () => void;
  data: BootstrapData;
}) {
  const [nodes, setNodes] = useState<JourneyNode[]>(props.nodes && props.nodes.length > 0 ? props.nodes : [
    { id: '1', category: 'trigger', type: 'new_contact', config: {}, position: { x: 0, y: 0 } }
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<JourneyNodeCategory | null>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const addNode = (category: JourneyNodeCategory, item: any, parentId: string, branch: 'next' | 'yes' | 'no') => {
    const newNode: JourneyNode = {
      id: Math.random().toString(36).substr(2, 9),
      category,
      type: item.type,
      config: {},
    };

    const newNodes = [...nodes, newNode];
    const parentNode = newNodes.find(n => n.id === parentId);
    if (parentNode) {
      if (branch === 'next') parentNode.nextId = newNode.id;
      if (branch === 'yes') parentNode.yesId = newNode.id;
      if (branch === 'no') parentNode.noId = newNode.id;
    }
    setNodes(newNodes);
    setActiveCategory(null);
  };

  const deleteNode = (id: string) => {
    // Remove references and the node itself
    const newNodes = nodes.filter(n => n.id !== id).map(n => ({
      ...n,
      nextId: n.nextId === id ? undefined : n.nextId,
      yesId: n.yesId === id ? undefined : n.yesId,
      noId: n.noId === id ? undefined : n.noId,
    }));
    setNodes(newNodes);
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const renderFlow = (nodeId: string | null | undefined, depth = 0, isLink = false) => {
    if (!nodeId) return null;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const palette = Palettes[node.category];
    const item = palette.items.find(i => i.type === node.type) || palette.items[0];

    return (
      <div className="flex flex-col items-center">
        {/* Connector Line */}
        {depth > 0 && <div className="h-8 w-0.5 bg-outline-variant/30" />}

        {/* Node Card */}
        <div 
          className={`relative group w-64 rounded-2xl border-2 p-4 transition-all hover:shadow-lg cursor-pointer ${selectedNodeId === node.id ? 'border-primary ring-4 ring-primary/10' : 'border-outline-variant/30 bg-surface-container-lowest'}`}
          onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-lg ${palette.color} transition-transform group-hover:scale-110`}>
              <span className="material-symbols-rounded text-xl">{item.icon}</span>
            </div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline-variant">{palette.label}</p>
              <h4 className="truncate text-sm font-bold text-on-surface">{item.label}</h4>
            </div>
          </div>

          {/* Quick Actions (Appear on Hover) */}
          <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button 
              className="flex h-6 w-6 items-center justify-center rounded-full bg-error text-on-error shadow-sm hover:opacity-90"
              onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
            >
              <span className="material-symbols-rounded text-xs">delete</span>
            </button>
          </div>
        </div>

        {/* Branch Logic */}
        <div className="flex gap-16 mt-0">
          {node.category === 'condition' ? (
            <>
              <div className="flex flex-col items-center">
                 <div className="h-8 w-0.5 bg-emerald-500/50" />
                 <div className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded uppercase tracking-widest mb-2">Yes</div>
                 {node.yesId ? renderFlow(node.yesId, depth + 1) : (
                    <AddButton onClick={() => setActiveCategory('trigger')} />
                 )}
              </div>
              <div className="flex flex-col items-center">
                 <div className="h-8 w-0.5 bg-rose-500/50" />
                 <div className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded uppercase tracking-widest mb-2">No</div>
                 {node.noId ? renderFlow(node.noId, depth + 1) : (
                    <AddButton onClick={() => setActiveCategory('trigger')} />
                 )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center">
               {node.nextId ? renderFlow(node.nextId, depth + 1) : (
                 node.type !== 'exit_journey' && (
                  <>
                    <div className="h-8 w-0.5 bg-outline-variant/30" />
                    <AddButton onClick={() => { setSelectedNodeId(node.id); setActiveCategory('action'); }} />
                  </>
                 )
               )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#f0f4f4] backdrop-blur-3xl lg:flex-row overflow-hidden">
      {/* Left Sidebar: Toolbar */}
      <div className="w-80 border-r border-outline-variant/20 bg-surface-container-lowest flex flex-col h-full shadow-2xl relative z-10">
        <div className="p-6 border-b border-outline-variant/10">
          <h2 className="font-headline text-2xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-rounded">route</span> Journey Builder
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant font-medium">Design complex customer conversion paths.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {(Object.entries(Palettes) as [JourneyNodeCategory, any][]).map(([key, cat]) => (
            <div key={key}>
              <h3 className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-outline flex items-center gap-2">
                <span className="material-symbols-rounded text-base">{cat.icon}</span> {cat.label}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {cat.items.map((item: any) => (
                  <button
                    key={item.type}
                    draggable
                    onDragStart={(e) => {
                       e.dataTransfer.setData("type", item.type);
                       e.dataTransfer.setData("category", key);
                    }}
                    className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low p-2.5 text-left transition-all hover:bg-surface-container hover:shadow-md group"
                    onClick={() => {
                        if (selectedNodeId) {
                          const parent = nodes.find(n => n.id === selectedNodeId);
                          if (parent?.category === 'condition') {
                             // Modal or prompt for which branch? For now default to Yes or prompt
                             addNode(key, item, selectedNodeId, 'yes');
                          } else {
                            addNode(key, item, selectedNodeId, 'next');
                          }
                        }
                    }}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-transform group-hover:scale-110 ${cat.color}`}>
                      <span className="material-symbols-rounded text-lg">{item.icon}</span>
                    </div>
                    <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-surface-container-lowest border-t border-outline-variant/20 flex gap-4 backdrop-blur-md">
          <button 
            onClick={props.onCancel} 
            className="flex-1 rounded-2xl border border-outline-variant/30 bg-surface-container px-4 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high transition-all active:scale-95"
          >
            Discard
          </button>
          <button 
            onClick={() => props.onSave(nodes)} 
            className="flex-1 rounded-2xl bg-primary px-4 py-4 text-xs font-bold uppercase tracking-widest text-on-primary shadow-xl shadow-primary/30 hover:opacity-95 hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-rounded text-sm">auto_awesome</span> Save Journey
          </button>
        </div>
      </div>

      {/* Main Area: Canvas */}
      <div className="flex-1 overflow-auto bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:24px_24px] p-20 flex justify-center items-start min-h-full">
         {renderFlow(nodes[0]?.id)}
      </div>

      {/* Right Sidebar: Configuration */}
      {selectedNodeId && (
        <div className="w-80 border-l border-outline-variant/20 bg-surface-container-lowest p-6 h-full shadow-2xl relative z-10 overflow-y-auto">
           <div className="flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/10">
              <h3 className="font-headline text-lg font-bold text-primary">Node Settings</h3>
              <button onClick={() => setSelectedNodeId(null)} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface-container text-outline transition-colors"><span className="material-symbols-rounded">close</span></button>
           </div>

           {selectedNode && (
             <div className="space-y-6">
                <NodeConfigurator node={selectedNode} data={props.data} onChange={(config) => {
                   setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, config } : n));
                }} />
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-outline-variant/40 text-outline-variant transition-all hover:border-primary hover:text-primary hover:scale-110 active:scale-95 bg-surface-container-lowest/50"
    >
      <span className="material-symbols-rounded">add</span>
    </button>
  );
}

function NodeConfigurator({ node, data, onChange }: { node: JourneyNode; data: BootstrapData; onChange: (config: any) => void }) {
    // Shared config logic
    if (node.type === 'send_whatsapp' || node.type === 'send_generic_message') {
      return (
        <div className="space-y-4">
           <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
             <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">Target Details</p>
             <label className="block text-xs font-bold text-on-surface mb-2">Message Template</label>
             <select 
               className="atrium-input bg-surface-container-lowest"
               value={node.config.templateId || ""}
               onChange={e => onChange({ ...node.config, templateId: e.target.value })}
             >
                <option value="">Select a template...</option>
                {data.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
             </select>
           </div>
           
           <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
             <label className="block text-xs font-bold text-emerald-900 mb-2">Sender Channel</label>
             <select 
               className="atrium-input bg-surface-container-lowest"
               value={node.config.channelId || ""}
               onChange={e => onChange({ ...node.config, channelId: e.target.value })}
             >
                <option value="">Select a channel...</option>
                {data.channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.whatsappNumber})</option>)}
             </select>
           </div>
        </div>
      );
    }

    if (node.type === 'time_delay') {
      return (
        <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
           <label className="block text-xs font-bold text-rose-900 mb-2">Wait Duration (Minutes)</label>
           <input 
             type="number"
             className="atrium-input bg-surface-container-lowest"
             value={node.config.minutes || 0}
             onChange={e => onChange({ ...node.config, minutes: parseInt(e.target.value) || 0 })}
           />
           <p className="mt-2 text-[10px] text-rose-500 italic">Contacts will pause here before moving to the next step.</p>
        </div>
      );
    }

    if (node.type === 'segment_joined' || node.type === 'is_in_segment') {
      return (
        <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
           <p className="text-[10px] font-bold text-amber-900 uppercase tracking-wider mb-3">Segment Filter</p>
           <label className="block text-xs font-bold text-amber-900 mb-2">Target Segment</label>
           <select 
             className="atrium-input bg-surface-container-lowest"
             value={node.config.segmentId || ""}
             onChange={e => onChange({ ...node.config, segmentId: e.target.value })}
           >
              <option value="">Select segment...</option>
              {data.segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
           </select>
           <p className="mt-2 text-[10px] text-amber-600 italic">This {node.category === 'trigger' ? 'starts the journey' : 'checks membership'} for contacts in this segment.</p>
        </div>
      );
    }

    if (node.type === 'incoming_keyword') {
      return (
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
           <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-3">Keyword Match</p>
           <label className="block text-xs font-bold text-emerald-900 mb-2">Keyword</label>
           <input 
             type="text"
             className="atrium-input bg-surface-container-lowest"
             placeholder="e.g. PRICE or HELP"
             value={node.config.keyword || ""}
             onChange={e => onChange({ ...node.config, keyword: e.target.value })}
           />
        </div>
      );
    }

    return <div className="text-center py-10 opacity-40"><span className="material-symbols-rounded text-4xl block mb-2">tune</span><p className="text-xs font-bold">No settings required</p></div>;
}
