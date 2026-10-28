import { Effect } from "effect"
import type { DatabaseMigration } from "../migration.js"

const migration: DatabaseMigration.Migration = {
  id: "20261028133841_session_time_busy",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`ALTER TABLE \`session_v2\` ADD \`time_busy\` integer;`)
      // A Session still holding an execution claim resumes the claimed turn, so keep its start.
      yield* tx.run("UPDATE `session_v2` SET `time_busy` = `time_suspended` WHERE `time_suspended` IS NOT NULL;")
    })
  },
}

export default migration
