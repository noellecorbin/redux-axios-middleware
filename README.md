# redux-axios-middleware
Sample thunk to reduce redux action boilerplate

Configuration - add when setting up redux configuration
```build
const configureStore = (initialState = {}, rootReducer = {}) => {
  if (process.env.NODE_ENV === 'development') {
    const middlewares = [thunk, axiosRequest];

    const composeEnhancers =
      (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ &&
        window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({ trace: true, traceLimit: 25 })) ||
      compose;

    const store = createStore(
      rootReducer,
      composeEnhancers(applyMiddleware(...middlewares)),
    );

    return store;
  }
```

Use - add to action object - when dispatching action
```build
return dispatch({
      type: ACTION_TYPE_CONSTANT,
      url: url,
      useCustomMiddleware: true,
      method: 'get',    // post, put, delete, patch.
    });
```

Action Object fields
* type - unique string (required)
* url - endpoint (required)
* method - must be 1 of `get/put/post/delete/patch` (required)
* useCustomMiddleware - must be true to use custom middleware. when false middleware is skipped (default - false)
* cancellable - cancel request if duplicate (default - false)
* cancelRequest - cancel request when true (default - false)
* headers - object containing header data to add to request ({headerName: headerValue, ...})
* data - object containing post/put form data
* onSuccessActions - array of actions to run if request is successful
* onFailureActions - array of actions to run if request fails
