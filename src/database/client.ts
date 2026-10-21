import Database from "@tauri-apps/plugin-sql";

let nativeDatabase: Promise<Database> | undefined;

export function getNativeDatabase(): Promise<Database> {
  nativeDatabase ??= Database.load("sqlite:sticky.db")
    .then(async (database) => {
      await database.execute("PRAGMA foreign_keys = ON");
      return database;
    })
    .catch((reason: unknown) => {
      // A transient startup failure must not poison every later database request.
      nativeDatabase = undefined;
      throw reason;
    });
  return nativeDatabase;
}
