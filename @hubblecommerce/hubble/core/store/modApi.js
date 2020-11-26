import {datetimeUnixNow, datetimeUnixNowAddSecs} from '@hubblecommerce/hubble/core/utils/datetime';
import axios from 'axios';
import _ from 'lodash';

export const state = () => ({

    // API
    apiAuthToken: null,
    apiAuthResponse: {},
    apiCacheTTL: 600, // secs
    apiLocale: null,

    // Data API
    apiResourcesAuthToken: null,
    apiResourcesAuthResponse: {},
    apiResourcesCacheTTL: 600, // secs
    apiResourcesLocale: null,

    // Payment API
    apiPaymentAuthToken: null,
    apiPaymentAuthResponse: {},
    apiPaymentCacheTTL: 120, // secs
})

export const getters = {
    getApiAuthResponse: state => {
        return state.apiAuthResponse;
    },
    getApiPaymentAuthResponse: state => {
        return state.apiPaymentAuthResponse;
    },
    getApiResourcesAuthResponse: state => {
        return state.apiResourcesAuthResponse;
    }
}

export const mutations = {
    setApiAuthResponse: (state, payload) => {
        state.apiAuthResponse = payload.data;
        state.apiAuthToken = payload.data.access_token;

        if (payload.cacheable) {
            let _ttl = payload.cacheTTL || state.apiCacheTTL;

            state.apiAuthResponse.created_at_unixtime = datetimeUnixNow();
            state.apiAuthResponse.expires_at_unixtime = datetimeUnixNowAddSecs(_ttl);
        }
    },
    setApiPaymentAuthResponse: (state, payload) => {
        state.apiPaymentAuthResponse = payload.data;
        state.apiPaymentAuthToken = payload.data.access_token;

        if (payload.cacheable) {
            let _ttl = payload.cacheTTL || state.apiPaymentCacheTTL;

            state.apiPaymentAuthResponse.created_at_unixtime = datetimeUnixNow();
            state.apiPaymentAuthResponse.expires_at_unixtime = datetimeUnixNowAddSecs(_ttl);
        }
    },
    setApiResourcesAuthResponse: (state, payload) => {
        state.apiResourcesAuthResponse = payload.data;
        state.apiResourcesAuthToken = payload.data.access_token;

        if (payload.cacheable) {
            let _ttl = payload.cacheTTL || state.apiResourcesCacheTTL;

            state.apiResourcesAuthResponse.created_at_unixtime = datetimeUnixNow();
            state.apiResourcesAuthResponse.expires_at_unixtime = datetimeUnixNowAddSecs(_ttl);
        }
    }
}

export const actions = {
    async apiGetAuth({commit})
    {
      return new Promise(function(resolve, reject) {
        axios({
          method: 'POST',
          url: _.trim(process.env.APP_BASE_URL, '/') + '/api/client-auth',
          data: {
            apiType: 'workhorse'
          }
        })
        .then((response) => {
          commit('setApiAuthResponse', {
            data: response.data,
            cacheable: !!response.data.expires_in || false,
            cacheTTL: response.data.expires_in || null
          });

          resolve(response.data);
        })
        .catch(error => {
          reject(error);
        });
      });
    },
    async apiPaymentGetAuth({commit})
    {
        return new Promise(function(resolve, reject) {
            axios({
                method: 'POST',
                url: _.trim(process.env.APP_BASE_URL, '/') + '/api/client-auth',
                data: {
                    apiType: 'payment'
                }
            })
                .then((response) => {
                    commit('setApiPaymentAuthResponse', {
                        data: response.data,
                        cacheable: !!response.data.expires_in || false,
                        cacheTTL: response.data.expires_in || null
                    });

                    resolve(response.data);
                })
                .catch(error => {
                    reject(error);
                });
        });
    },
    async apiResourcesGetAuth({commit})
    {
        return new Promise(function(resolve, reject) {
            axios({
                method: 'POST',
                url: _.trim(process.env.APP_BASE_URL, '/') + '/api/client-auth',
                data: {
                    apiType: 'resources'
                }
            })
                .then((response) => {
                    commit('setApiResourcesAuthResponse', {
                        data: response.data,
                        cacheable: !!response.data.expires_in || false,
                        cacheTTL: response.data.expires_in || null
                    });

                    resolve(response.data);
                })
                .catch(error => {
                    reject(error);
                });
        });
    },
    async apiCheckAuth({dispatch, state, rootState}, payload)
    {
        // console.log("apiCheckAuth - payload: %o", payload);

        let _authResponse = null;

        if (payload.apiType === 'data') {
            _authResponse = state.apiResourcesAuthResponse;
        }

        if (payload.apiType === 'payment') {
            _authResponse = state.apiPaymentAuthResponse;

            // use customer oauth, if present but is no guest
            if (!_.isEmpty(rootState.modApiPayment.customer.customerAuth) && !rootState.modApiPayment.customer.isGuest) {
                _authResponse = rootState.modApiPayment.customer.customerAuth.token
            }
        }

        if (payload.apiType === 'workhorse') {
            _authResponse = state.apiAuthResponse;
        }

        // use customer oauth, if requested
        if (payload.tokenType === 'customer') {
            _authResponse = rootState.modApiPayment.customer.customerAuth.token;
        }

        if (payload.tokenType === 'sw') {
            _authResponse = process.env.API_SW_ACCESS_KEY;
        }

        // fetch new auth token, if not valid ...
        if (_.has(_authResponse, 'expires_at_unixtime') && _authResponse.expires_at_unixtime < datetimeUnixNow()) {

            if (payload.apiType === 'data') {
                _authResponse = await dispatch('apiResourcesGetAuth');
            }

            if (payload.apiType === 'payment') {
                _authResponse = await dispatch('apiPaymentGetAuth');
            }

            if (payload.apiType === 'workhorse') {
                _authResponse = await dispatch('apiGetAuth');
            }

            // xxx: renew possibly expired customer auth!!!
        }

        // return a promise (auth response)
        return new Promise((resolve, reject) => {
            resolve(_authResponse);
        });
    },
    /**
     * @apiCall
     *
     * @param {Object} state
     * @param {Object} payload
     * @param payload.action Axios method e.g. 'get', 'post', 'patch', 'delete'
     * @param payload.endpoint Endpoint of api e.g '/api/login'
     * @param payload.tokenType Choose between type 'api' and 'customer'
     * @param payload.apiType Choose between type 'data' and 'payment'
     *
     * returns {Promise}
     */
    apiCall: {
        root: true,
        async handler({dispatch, state, rootState}, payload)
        {
            // console.log("apiCall - payload: %o", payload);

            // Set data if data isset
            let payloadData = {};
            if (!_.isEmpty(payload.data)) {
                payloadData = payload.data;
            }

            // Set Store ID to request data
            if (!_.isEmpty(process.env.STORE_ID) && payloadData !== null) {
                _.assign(payloadData, {storeId: process.env.STORE_ID});
            }

            // Set data if data isset
            let payloadParams = {};
            if (!_.isEmpty(payload.params)) {
                payloadParams = payload.params;
            }

            // Set Store ID to request data
            if (!_.isEmpty(process.env.STORE_ID) && payloadParams !== null) {
                _.assign(payloadParams, {storeId: process.env.STORE_ID});
            }

            // Reset params if action is post
            if (payload.action === 'post' || payload.action === 'patch') {
                payloadParams = '';
            }

            // Set base url depending on api type
            let baseUrl;
            if (process.env.API_TYPE === 'api') {
                if (payload.apiType === 'data') {
                    baseUrl = _.join([
                        _.trim(process.env.API_BASE_URL, '/'),
                        _.trim(process.env.API_BASE_PFX, '/')
                    ], '/');
                }
                if (payload.apiType === 'payment') {
                    baseUrl = _.join([
                        _.trim(process.env.API_PAYMENT_BASE_URL, '/'),
                        _.trim(process.env.API_PAYMENT_BASE_PFX, '/')
                    ], '/');
                }
            }

            if (process.env.API_TYPE === 'workhorse') {
                baseUrl = _.join([
                    _.trim(process.env.API_WORKHORSE_BASE_URL, '/'),
                    _.trim(process.env.API_WORKHORSE_BASE_PFX, '/')
                ], '/');
            }

            if (process.env.API_TYPE === 'sw') {
                baseUrl = process.env.API_BASE_URL;
            }

            return new Promise(function(resolve, reject) {
                dispatch('apiCheckAuth', {
                    apiType: payload.apiType,
                    tokenType: payload.tokenType
                })
                    .then((response) => {

                        let _authToken = null;

                        // set by 'apiCheckAuth' response
                        if (_.has(response, 'access_token')) {
                            _authToken = response.access_token;
                        } else {
                            _authToken = response;
                        }

                        // Set custom headers depending on api type including authToken
                        let _headers = {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        };

                        if (process.env.API_TYPE === 'sw') {
                            _.assign(_headers, {'sw-access-key': process.env.API_SW_ACCESS_KEY});

                            if (payload.swContext != null) {
                                _.assign(_headers, {'sw-context-token': payload.swContext});
                            }
                        } else {
                            _.assign(_headers, {'Authorization': 'Bearer ' + _authToken});
                        }

                        // call
                        axios({
                            method: payload.action,
                            url: _.join([baseUrl, _.trim(payload.endpoint, '/')], '/'),
                            headers: _headers,
                            params: payloadParams, // GET params
                            data: payloadData // POST data
                        })
                            .then((response) => {
                                //console.log("API request  %o to %o finished: %o", payload.action, payload.endpoint, response);

                                // Check if 200 response data has error the flag true
                                // And if true, reject the errors
                                if (response.status === 200 && response.data.error) {
                                    reject(response.data)
                                }

                                resolve(response);
                            })
                            .catch((error) => {
                                let rejection = error;

                                if (error.response) {
                                    // The request was made and the server responded with a status code
                                    // that falls out of the range of 2xx

                                    // reject errors
                                    rejection = error.response.data;
                                } else if (error.request) {
                                    // The request was made but no response was received
                                    // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                                    // http.ClientRequest in node.js

                                    if (payload.tokenType === 'sw') {
                                        rejection = 'No network connection';
                                    } else {
                                        rejection = error.request;
                                    }
                                } else {
                                    // Something happened in setting up the request that triggered an Error
                                    rejection = error.message;
                                }
                                //console.log("API request %o to %o failed: %o", payload.action, payload.endpoint, response);
                                reject(rejection)
                            });
                    })
                    .catch(error => {
                        // console.log("apiCall - apiCheckAuth error: %o", error);
                        reject(error);
                    });
            });
        }
    }
}
