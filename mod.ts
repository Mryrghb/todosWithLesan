import {
  ActFn,
  optional,
  enums,
  number,
  lesan,
  defaulted,
  array,
  Document,
  Filter,
  ship,
  limit,
  removeRelation,
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
  level: enums(["Admin", "Normal"]),
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

//_____________________ TODO MODEL ___________________ //

const todoPure = {
  title: string(),
  description: string(),
  done: boolean(),
  tag: string(),
};

const TodosRelations = {
  user: {
    optional: false,
    schemaName: "user",
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
  categories: {
    optional: false,
    schemaName: "category",
    type: "multiple" as RelationDataType,
    limit: 10,
    sort: {
      field: "_id",
      order: "desc" as RelationSortOrderType,
    },
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

const todos = coreApp.odm.newModel("todos", todoPure, TodosRelations);

// Auth Section //
const setUser = async () => {
  const context = coreApp.contextFns.getContextModel();

  const userId = context.Headers.get("userId");

  if (!userId) {
    throw new Error("you can not do this Act!");
  }

  const foundedUser = await user.findOne({
    filters: { _id: new ObjectId(userId) },
  });

  if (!foundedUser) {
    throw new Error("Can not find this user!");
  }

  coreApp.contextFns.setContext({ User: foundedUser });
};
// any user can not add set admin level when loged in todos
const checkLevel = async () => {
  const context = coreApp.contextFns.getContextModel();

  if (!context.User) {
    throwError("You most be loged in");
  }

  if (context.User.level === "Admin") {
    return;
  }

  coreApp.contextFns.addBodyToContext({
    // this addBodyToContext is for create any details in body
    ...context.body!, //bangsign - that's mean has been before
    details: {
      //most add details
      ...context.body!.details,
      set: {
        ...context.body!.details.set,
        level: "Normal",
      },
    },
  });
};

const justAdmin = async () => {
  const context = coreApp.contextFns.getContextModel();

  if (context.User.level !== "Admin") {
    throw new Error("Just Admin can do this Act");
  }
};

//_________________ USE IN FRONT-END -- ADD USER VALIDATOR __________________ //

const addUserValidator = () => {
  return object({
    set: object({
      fullName: string(),
      email: string(),
      password: string(),
      level: defaulted(enums(["Admin", "Normal"]), "Normal"),
    }),
    get: coreApp.schemas.selectStruct("user", 1),
  });
};

// _____________ add data in mongoDb ___________________//
// FN Section - user validator

const addUser: ActFn = async (body) => {
  const { fullName, email, password, level } = body.details.set;
  return await user.insertOne({
    doc: { fullName, email, password, level },
    projection: body.details.get,
  });
};

// _______________________ SET user FN ______________________ //

coreApp.acts.setAct({
  schema: "user",
  actName: "addUser",
  validator: addUserValidator(), // return a object struct
  fn: addUser, // give a async function
  preValidation: [setUser, checkLevel],
  validationRunType: "create",
});

//_________________________ ADD TODO VALIDATOR ______________________ //

const addTodosValidator = () => {
  return object({
    set: object({
      ...todoPure,
      userId: objectIdValidation,
      categoryId: array(objectIdValidation),
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

// __________________ TODO FN ______________________ //

const addTodo: ActFn = async (body) => {
  const { title, description, categoryId, tag, done, userId } =
    body.details.set;
  const obIdCategory = categoryId.map((lc: string) => new ObjectId(lc));
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
        _ids: obIdCategory,
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
// FOR REPLACE GROUP CATEGORY

const updateCategoryTodoValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      categoryId: objectIdValidation,
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

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

coreApp.acts.setAct({
  schema: "todos",
  actName: "updateCategoryTodo",
  validator: updateCategoryTodoValidator(),
  fn: updateCategoryTodo,
});

//_________________________________________________ REMOVE TODO OF CATEGORIES - THATS ACT FALSE BECUASE IT'S NOT LOGICAL
// JUST FOR TEST REMOVERELATION
const delTodoOfCategoriesValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      categoryId: array(objectIdValidation),
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

const deleteTodoOfCategories: ActFn = async (body) => {
  const { categoryId, _id } = body.details.set;
  const obIdCategory = categoryId.map((lc: string) => new ObjectId(lc));
  return await todos.removeRelation({
    filters: { _id: new ObjectId(_id) },
    projection: body.details.get,
    relations: {
      categories: {
        _ids: obIdCategory,
        relatedRelations: {
          todos: true,
        },
      },
    },
  });
};
coreApp.acts.setAct({
  schema: "todos",
  actName: "deleteTodoOfCategories",
  validator: delTodoOfCategoriesValidator(),
  fn: deleteTodoOfCategories,
});

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

//______________________________ DELETE USER  _____________________________ //
const deleteUserValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
    }),
    get: object({
      success: optional(enums([0, 1])),
    }),
  });
};

const deleteUser: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  return await todos.deleteOne({
    filters: { _id: new ObjectId(_id) },
  });
};
coreApp.acts.setAct({
  schema: "user",
  actName: "deleteUser",
  validator: deleteUserValidator(),
  fn: deleteUser,
  preAct: [setUser, justAdmin],
});

//______________________________ GET TODOS WITH PAGENATION _____________________________ //
const getAllTodosValidator = () => {
  return object({
    set: object({
      page: number(),
      take: number(),
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};
const getAllTodos: ActFn = async (body) => {
  let {
    set: { page, take },
    get,
  } = body.details;

  page = page || 1;
  take = take || 50;
  const skip = take * (page - 1);

  return await todos
    .find({
      projection: get,
    })
    .skip(skip)
    .limit(take)
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

//______________________________ UPDATE TODO  _____________________________ //
const updateTodoValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
      title: optional(string()),
      description: optional(string()),
      done: optional(boolean()),
      tag: optional(string()),
    }),
    get: coreApp.schemas.selectStruct("todos", 1),
  });
};

const updateTodo: ActFn = async (body) => {
  const {
    set: { _id, tag, title, description, done },
    get,
  } = body.details;

  const updateObj: Document = {};
  title && (updateObj.title = title);
  description && (updateObj.description = description);
  tag && (updateObj.tag = tag);
  done && (updateObj.done = done);

  return await todos.findOneAndUpdate({
    filters: { _id: new ObjectId(_id) },
    update: { $set: updateObj },
    projection: get,
  });
};
coreApp.acts.setAct({
  schema: "todos",
  actName: "updateTodo",
  validator: updateTodoValidator(),
  fn: updateTodo,
});

//______________________________ DELETE TODO  _____________________________ //
const deleteTodoValidator = () => {
  return object({
    set: object({
      _id: objectIdValidation,
    }),
    get: object({
      success: optional(enums([0, 1])),
    }),
  });
};

const deleteTodo: ActFn = async (body) => {
  const {
    set: { _id },
    get,
  } = body.details;

  return await todos.deleteOne({
    filters: { _id: new ObjectId(_id) },
  });
};
coreApp.acts.setAct({
  schema: "todos",
  actName: "deleteTodo",
  validator: deleteTodoValidator(),
  fn: deleteTodo,
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
