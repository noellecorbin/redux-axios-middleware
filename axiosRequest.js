import axios from 'axios';
import { has, omit } from 'lodash';
import cacheActions from 'actions/cacheActions';
import {
  CANCEL_REQUEST,

} from 'constants/actionTypes';

let cancelFunctions = {};

const actionIsValid = (action) => {
  /** If specified to use middleware and method is present return true **/
  if (
    action?.useCustomMiddleware === true &&
    has(action, 'method') &&
      action.url &&
    ['get', 'put', 'post', 'delete', 'patch'].indexOf(action.method.toLowerCase()) > -1
  ) {
    return true;
  }
  return false;
};


axios.interceptors.response.use(null, function (error) {
  // TODO - may need some tweaking once cors headers are resolved
  if (has(error, 'response.status') && error.response.status === 503) {
    return Promise.reject({
      ...error,
      response: {
        status: 503,
      },
    });
  } else {
    return Promise.reject(error);
  }
});

const axiosRequest = (store) => {
  return (next) => {
    return (action) => {
      let CancelToken = null;
      const args = [];
      /** if there's no type do nothing **/
      if (!action.type) {
        return next(action);
      }
      /** if cancelfunction exists and cancel is true or there was a request to cancel, cancel the last request **/
      if (cancelFunctions[action.type] && (action.cancellable || action.cancelRequest)) {
        // cancel previous request
        cancelFunctions[action.type].cancel('cancelled 1');
        // remove the cancel token
        cancelFunctions = omit(cancelFunctions, action.type);
        // if there was request to cancel then we want to finish here
        if (action.cancelRequest) {
          return store.dispatch({
            type: `${action.type}_FINISH`,
          });
        }
      }
      /** If action is not valid do nothing **/
      if (!actionIsValid(action, store)) {
        const actionToReturn = {
          ...action,
          type: `${action.type}`,
        };
        return next(actionToReturn);
      }

      /**
       * to use the following you must have a reducer 'cache' that contains an object 'cachedData'
       * */
      /**
      if (action.cache) {
        const oldResponse = {
          ...store.getState().cache.cachedData[action.cache.name],
        };
        const newResponse = {
          queryUrl: action.url,
        };
        // compare data to see if data exists, if the requests are the same, and if the valid period has not passed
        // if all 3, use cached data
        if (
          oldResponse.data &&
          oldResponse.data.length > 0 &&
          oldResponse.queryUrl === newResponse.queryUrl &&
          (!action.cache.invalidateAt ||
            Date.now() - oldResponse.lastFetched < action.cache.invalidateAt)
        ) {
          store.dispatch({
            type: CANCEL_REQUEST,
          });
          const actionToReturn = {
            ...action,
            type: `${action.type}_SUCCESS`,
            ...oldResponse.data,
          };
          return next(actionToReturn);
        }
      }
      **/

      /** we know format is valid - 2nd item of actionTest tells us what axios should do **/
      let axiosAction = action.method;
      if (!axiosAction) {
        const actionTest = action.type.split('_');
        axiosAction = actionTest[1].toLowerCase();
      }

      // any default headers that should go in every request (client-version, etc)
      const defaultHeaders = {
      };

      /** add non-auth headers **/
      let headers = {
        ...defaultHeaders,
      };
      // pass in auth token, etc
      if (has(action, 'headers') && action.headers) {
        headers = { ...action.headers };
      }

      /** add all headers to args **/
      args[0] = { headers };
      if (action.responseType) {
        args[0].responseType = action.responseType;
      }

      /** create cancel function and add to headers if specified **/
      if (action.cancellable) {
        CancelToken = axios.CancelToken;
        const source = CancelToken.source();
        args[0].cancelToken = source.token;
        cancelFunctions[action.type] = source;
      }
      if (action.data) {
        if (action.method && action.method.toLowerCase() === 'delete') {
          args[0].data = action.data;
        } else {
          args.unshift(action.data);
        }
      }

      //  axios.defaults.withCredentials = true;
      // for loading
      store.dispatch({ type: `${action.type}_BEGIN`, ...action.beginProps });

      /** axios request **/
      axios[axiosAction](action.url, ...args)
        .then((response) => {
          const actionToReturn = {
            ...action,
            response,
          };


          actionToReturn.type = `${action.type}_SUCCESS`;

          /** set up cache for new data - use only if cacheActions.cacheData exists **/
          /**
          if (action.cache) {
            store.dispatch(
              cacheActions.cacheData(
                action.cache.name,
                action.url,
                null,
                null,
                actionToReturn.payload,
                actionToReturn.pagination,
              ),
            );
          }
              **/

          /** if extra actions on success were specified, run them **/
          if (action.onSuccessActions && action.onSuccessActions.length > 0) {
            action.onSuccessActions.forEach((successAction) => {
              if (typeof successAction === 'function') {
                store.dispatch((dispatch, getState) =>
                  successAction(dispatch, getState, actionToReturn),
                );
              } else {
                store.dispatch(successAction);
              }
            });
          }
          next(actionToReturn);
        })
        .catch((error) => {
          //console.log(error);
          if (has(error, 'response.status')) {
            const status = error.response.status;

            if (status === 503) {
              window.location.href = `https://${window.location.hostname}/maintenance`;
            }
            if (status === 404) {
              window.location.href = '/404';
            }
          }

          const actionToReturn = {
            ...action,
            type: `${action.type}_FAILURE`,
            error: error,
          };

          /** return _CANCEL instead of FAILURE so you don't set orig. request loading to false **/
          if (axios.isCancel(error)) {
            return next({
              ...action,
              type: `${action.type}_CANCEL`,
            });
          }
          /** if extra actions on failure were specified, run them **/
          if (action.onFailureActions && action.onFailureActions.length > 0) {
            action.onFailureActions.forEach((failureAction) => {
              if (typeof failureAction === 'function') {
                store.dispatch((dispatch, getState) =>
                  failureAction(
                    dispatch,
                    getState,
                    error,
                  ),
                );
              } else {
                store.dispatch(failureAction);
              }
            });
          }
          next(actionToReturn);
        })
        .then((data) => {
          if (!data || (data.type && data.type.indexOf('_CANCEL') === -1)) {
            return store.dispatch({
              type: `${action.type}_FINISH`,
            });
          }
        });
    };
  };
};

export default axiosRequest;
