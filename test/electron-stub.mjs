// Stand-in for the `electron` module so src/main/db.ts can run in plain Node for tests.
export const app = { getPath: () => process.env.TEST_USERDATA }
