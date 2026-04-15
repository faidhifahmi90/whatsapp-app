import session from "express-session";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const dbPath = resolve(process.cwd(), "data", "whatsapp-center.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

function getExpiryMilliseconds(sess: session.SessionData) {
  if (sess.cookie?.expires) {
    return new Date(sess.cookie.expires).getTime();
  }
  const maxAge = typeof sess.cookie?.maxAge === "number" ? sess.cookie.maxAge : 1000 * 60 * 60 * 24 * 7;
  return Date.now() + maxAge;
}

export class SqliteSessionStore extends session.Store {
  private db: Database.Database;

  constructor() {
    super();
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      create table if not exists sessions (
        sid text primary key,
        sess text not null,
        expire integer not null
      );
      create index if not exists idx_sessions_expire on sessions(expire);
    `);
  }

  get(sid: string, callback: (err?: unknown, sessionData?: session.SessionData | null) => void) {
    try {
      const row = this.db.prepare("select sess, expire from sessions where sid = ?").get(sid) as
        | { sess: string; expire: number }
        | undefined;
      if (!row) {
        callback(null, null);
        return;
      }
      if (row.expire < Date.now()) {
        this.destroy(sid, () => callback(null, null));
        return;
      }
      callback(null, JSON.parse(row.sess) as session.SessionData);
    } catch (error) {
      callback(error);
    }
  }

  set(sid: string, sess: session.SessionData, callback?: (err?: unknown) => void) {
    try {
      const expire = getExpiryMilliseconds(sess);
      this.db
        .prepare(
          `insert into sessions (sid, sess, expire)
           values (?, ?, ?)
           on conflict(sid) do update set sess = excluded.sess, expire = excluded.expire`
        )
        .run(sid, JSON.stringify(sess), expire);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid: string, sess: session.SessionData, callback?: () => void) {
    try {
      this.db.prepare("update sessions set expire = ? where sid = ?").run(getExpiryMilliseconds(sess), sid);
      callback?.();
    } catch {
      callback?.();
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void) {
    try {
      this.db.prepare("delete from sessions where sid = ?").run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }
}
