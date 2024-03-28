import {
  lesan,
  string,
  object,
  MongoClient,
  ActFn,
} from "https://deno.land/x/lesan@v0.1.0/mod.ts";

const coreApp = lesan();

const client = await new MongoClient("mongodb://127.0.0.1:27017/").connect();

const db = client.db("todosLesan");

coreApp.odm.setDb(db);

const userPure = {
  fullName: string(),
  email: string(),
  password: string(),
};

const userRelations = {};

const users = coreApp.odm.newModel("users", userPure, userRelations);

const addUserValidator = () => {
  return object({
    set: object(userPure),
    get: object({ _id: enums([0, 1]) }),
  });
};

const addUser: ActFn = async (body) => {
  const { fullName, email, password } = body.details.set;
  await users.insertOne({
    doc: { fullName, email, password },
    projection: body.details.get,
  });
};

coreApp.acts.setAct({
  schema: "users",
  actName: "addUser",
  validator: addUserValidator(),

  fn: addUser,
});

coreApp.runServer({ port: 1366, typeGeneration: false, playground: true });
