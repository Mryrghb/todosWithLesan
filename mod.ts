import {
  ActFn,
  optional,
  enums,
  number,
  lesan,
  array,
  Document,
  Filter,
  ship,
  limit,
  replace,
  boolean,
  string,
  object,
  ObjectId,
  selectStruct,
  objectIdValidation,
  RelationDataType,
  RelationSortOrderType,
  MongoClient,
} from "https://deno.land/x/lesan@v0.1.0/mod.ts";

const coreApp = lesan();

const client = await new MongoClient("mongodb://127.0.0.1:27017/").connect();

const dbTodo = client.db("todosLesan");

coreApp.odm.setDb(dbTodo);

// ______________________ USER MODEL ________________________ //

const userPure = {
  fullName: string(),
  email: string(),
  password: string(),
};

const userRelations = {};

const user = coreApp.odm.newModel("user", userPure, userRelations);
// ______________________ CATEGORY MODEL ____________________//

const categoryPure = {
  name: string(),
};

const categoryRelations = {};

const category = coreApp.odm.newModel(
  "category",
  categoryPure,
  categoryRelations
);

//______________________ TAG MODEL _________________//

const tagPure = {
  name: string(),
};

const tagRelations = {};

const tag = coreApp.odm.newModel("tag", tagPure, tagRelations);

//_____________________ TODO MODEL ___________________ //

const todoPure = {
  title: string(),
  description: string(),
  done: boolean(),
  tag: string(),
};

const userTodosRelations = {
  user: {
    optional: true,
    schemaName: "user",
    type: "single" as RelationDataType,
    relatedRelations: {
      todos: {
        type: "multiple" as RelationDataType,
        limit: 5,
        sort: {
          field: "_id",
          order: "desc" as RelationSortOrderType,
        },
      },
    },
  },
  categories: {
    optional: false,
    schemaName: "category",
    type: "single" as RelationDataType,
    relatedRelations: {
      todos: {
        type: "multiple" as RelationDataType,
        limit: 10,
        sort: {
          field: "_id",
          order: "desc" as RelationSortOrderType,
        },
      },
    },
  },
};

const todos = coreApp.odm.newModel("todos", todoPure, userTodosRelations);

//_________________ USE IN FRONT-END -- USER VALIDATOR __________________ //

const addUserValidator = () => {
  return object({
    set: object(userPure),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// _____________ add data in mongoDb ___________________//
// FN Section - user validator

const addUser: ActFn = async (body) => {
  const { fullName, email, password } = body.details.set;
  return await user.insertOne({
    doc: { fullName, email, password },
    projection: body.details.get,
  });
};

// _______________________ SET user FN ______________________ //

coreApp.acts.setAct({
  schema: "user",
  actName: "addUser",
  validator: addUserValidator(), // return a object struct
  fn: addUser, // give a async function
});

//_________________________ TODO VALIDATOR ______________________ //

const addTodosValidator = () => {
  return object({
    set: object({
      ...todoPure,
      userId: objectIdValidation,
      categoryId: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

// __________________ TODO FN ______________________ //

const addTodo: ActFn = async (body) => {
  const { title, description, categoryId, tag, done, userId } =
    body.details.set;
  return await todos.insertOne({
    doc: { title, description, done, tag },
    relations: {
      user: {
        _ids: new ObjectId(userId),
        relatedRelations: {
          todos: true,
        },
      },
      categories: {
        _ids: new ObjectId(categoryId),
        relatedRelations: {
          todos: true,
        },
      },
    },
    projection: body.details.get,
  });
};

// __________________ SET TODO FN _______________________ //

coreApp.acts.setAct({
  schema: "todos",
  actName: "addTodo",
  validator: addTodosValidator(),
  fn: addTodo,
});

// ____________________ UPDATE CATEGORY TODO VALIDATOR _________________ //

const updateCategoryTodoValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      categoryId: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

// _______________________ UPDATE VATEGORY FN ________________________ //

const updateCategoryTodo: ActFn = async (body) => {
  const { title, description, _id, tag, done, categoryId } = body.details.set;
  return await todos.addRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      categories: {
        _ids: new ObjectId(categoryId),
        relatedRelations: {
          todos: true,
        },
      },
    },
    replace: true,
  });
};

// _______________________ SET UPDATE CATEGORY FN ____________________ //

coreApp.acts.setAct({
  schema: "todos",
  actName: "updateCategoryTodo",
  validator: updateCategoryTodoValidator(),
  fn: updateCategoryTodo,
});

//=================================================================================== not working - becuase relation is one to many
// ____________________ REMOVE TODO USER VALIDATOR _________________ //

const removeUsertodoValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      userId: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

// _______________________ REMOVE CATEGORY FN ________________________ //

const removeUserTodo: ActFn = async (body) => {
  const { _id, userId } = body.details.set;
  return await todos.addRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      user: {
        _ids: new ObjectId(userId),

        relatedRelations: {
          todos: true,
        },
      },
    },
    replace: true,
  });
};

// _______________________ SET REMOVE CATEGORY FN ____________________ //

coreApp.acts.setAct({
  schema: "user",
  actName: "removeUserTodo",
  validator: removeUsertodoValidator(),
  fn: removeUserTodo,
});
//==========================================================================================================================

//______________________________ GET USER  _____________________________ //
const getUsersValidator = () => {
  return object({
    set: object({ _id: objectIdValidation }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};
const getUsers: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  return await user.findOne({
    filters: { _id: new ObjectId(_id) },
    projection: get,
  });
};
coreApp.acts.setAct({
  schema: "user",
  actName: "getUsers",
  validator: getUsersValidator(),
  fn: getUsers,
});

//______________________________ GET TODOS WITH PAGENATION _____________________________ //
const getAllTodosValidator = () => {
  return object({
    set: object({
      page: number(),
      limit: number(),
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};
const getAllTodos: ActFn = async (body) => {
  let {
    set: { page, limit },
    get,
  } = body.details;

  page = page || 1;
  limit = limit || 50;
  const skip = limit * (page - 1);
  return await todos
    .find({ projection: get, filters: {} })
    .skip(skip)
    .limit(limit)
    .toArray();
};
coreApp.acts.setAct({
  schema: "todos",
  actName: "getAllTodos",
  validator: getAllTodosValidator(),
  fn: getAllTodos,
});
//______________________________ GET TODO BY TAG  _____________________________ //
const getTodoValidator = () => {
  return object({
    set: object({ userId: objectIdValidation, tag: string() }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};
const getTodo: ActFn = async (body) => {
  const {
    set: { userId, tag },
    get,
  } = body.details;
  return await todos.findOne({
    filters: { "user._id": new ObjectId(userId), tag },
    projection: get,
  });
};
coreApp.acts.setAct({
  schema: "todos",
  actName: "getTodo",
  validator: getTodoValidator(),
  fn: getTodo,
});

//__________________________ CATEGORY VALIDATOR ___________________//

const categoryValidator = () => {
  return object({
    set: object(categoryPure),
    get: coreApp.schemas.selectStruct("category", 2),
  });
};

// _____________________ FN SECTION ADD CATEGORY ___________________ //

const addCategory: ActFn = async (body) => {
  const { name } = body.details.set;
  return await category.insertOne({
    doc: { name },
    projection: body.details.get,
  });
};

// ________________________  ADD CATEGORY FN ________________________ //

coreApp.acts.setAct({
  schema: "category",
  actName: "addCategory",
  validator: categoryValidator(),
  fn: addCategory,
});

coreApp.runServer({ port: 5000, typeGeneration: false, playground: true });
