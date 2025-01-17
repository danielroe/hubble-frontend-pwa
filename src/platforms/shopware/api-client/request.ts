/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
// @ts-ignore
import { ApiError } from './ApiError';
// @ts-ignore
import type { ApiRequestOptions } from './ApiRequestOptions';
// @ts-ignore
import type { ApiResult } from './ApiResult';
// @ts-ignore
import { CancelablePromise } from './CancelablePromise';
// @ts-ignore
import type { OnCancel } from './CancelablePromise';
// @ts-ignore
import type { OpenAPIConfig } from './OpenAPI';
import { usePlatform } from '#imports'
// @ts-ignore
import { OpenAPI } from './OpenAPI'
import { useCookie, useNuxtApp } from '#app'
// @ts-ignore
import { hblGetRequestCookie } from '@/utils/helper'
import { Pinia, storeToRefs } from 'pinia'

const isDefined = <T>(value: T | null | undefined): value is Exclude<T, null | undefined> => {
    return value !== undefined && value !== null;
};

const getQueryString = (params: Record<string, any>): string => {
    const qs: string[] = [];

    const append = (key: string, value: any) => {
        qs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    };

    const process = (key: string, value: any) => {
        if (isDefined(value)) {
            if (Array.isArray(value)) {
                value.forEach(v => {
                    process(`${key}[]`, v);
                });
            } else if (typeof value === 'object') {
                Object.entries(value).forEach(([k, v]) => {
                    process(`${key}[${k}]`, v);
                });
            } else {
                append(key, value);
            }
        }
    };

    Object.entries(params).forEach(([key, value]) => {
        process(key, value);
    });

    if (qs.length > 0) {
        return `?${qs.join('&')}`;
    }

    return '';
};

const getUrl = (config: OpenAPIConfig, options: ApiRequestOptions): string => {
    const encoder = config.ENCODE_PATH || encodeURI;

    const path = options.url
        .replace('{api-version}', config.VERSION)
        .replace(/{(.*?)}/g, (substring: string, group: string) => {
            if (options.path?.hasOwnProperty(group)) {
                return encoder(String(options.path[group]));
            }
            return substring;
        });

    const url = `${config.BASE}${path}`;
    if (options.query) {
        return `${url}${getQueryString(options.query)}`;
    }

    return url;
};

const catchErrorCodes = (options: ApiRequestOptions, result: any): ApiError | boolean => {
    const response = result.response

    if (!response) {
        // @ts-ignore
        return new Error(result);
    }

    const errors: Record<number, string> = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        ...options.errors,
    }

    let error = errors[response.status];

    if (error) {
        return new ApiError(options, response, error);
    }

    if (!response.ok) {
        return new ApiError(options, response, 'Generic Error');
    }

    return false
};

export const cachedRoutes = [
    '/pwa/page',
    '/navigation/'
]

/**
 * Request method
 * @param config The OpenAPI configuration object
 * @param options The request options from the service
 * @returns CancelablePromise<T>
 * @throws ApiError
 */
export const request = <T>(config: OpenAPIConfig, options: ApiRequestOptions): CancelablePromise<T> => {
    const app = useNuxtApp()
    const platformStore = usePlatform(app.$pinia as Pinia)
    const { session } = storeToRefs(platformStore)
    const { apiUrl, apiAuthToken, platformLanguages, setSessionToken } = platformStore

    let platformHeaders: Record<string, string> = {
        'sw-access-key': apiAuthToken,
        'sw-include-seo-urls': 'true'
    }

    if (process.server) {
        const sessionCookie = hblGetRequestCookie(app, app.$config.public.sessionCookie.name)
        if (sessionCookie != null) {
            setSessionToken(sessionCookie)
        }
    }

    if(session?.value?.sessionToken != null) {
        platformHeaders['sw-context-token'] = session?.value?.sessionToken
    }

    let customerCookie = null
    if (process.server) {
        customerCookie = hblGetRequestCookie(app, app.$config.public.customerCookie.name)
    }

    if (process.client) {
        customerCookie = useCookie(app.$config.public.customerCookie.name).value
    }

    if (customerCookie != null && app.$config.public.setCustomerLoggedInHeader) {
        platformHeaders['sw-customer'] = '1'
    }

    const locale = app.vueApp.config.globalProperties.$i18n?.locale

    if(platformLanguages != null && platformLanguages?.length > 0 && locale) {
        const matchingLang = platformLanguages.find((lang: any) => {
            return lang.route === locale
        })

        if (matchingLang) {
            platformHeaders['sw-language-id'] = matchingLang.id
        }
    }

    OpenAPI.BASE = apiUrl
    OpenAPI.HEADERS = platformHeaders

    return new CancelablePromise(async (resolve: any, reject: any) => {
        try {
            if (typeof config.HEADERS === 'undefined') {
                return false
            }

            const headers = Object.assign(config.HEADERS, options.headers)

            const response = await $fetch.raw(
                getUrl(config, options),
                {
                    method: options.method,
                    body: options.body,
                    headers: headers,
                    onRequest: async (ctx) => {
                        // @ts-ignore
                        app.$hblBus.$emit('onRequest', { data: ctx })
                    },
                    onRequestError: async (ctx) => {
                        // @ts-ignore
                        app.$hblBus.$emit('onRequestError', { data: ctx })
                    },
                    onResponse: async (ctx) => {
                        // @ts-ignore
                        app.$hblBus.$emit('onResponse', { data: ctx })
                    },
                    onResponseError: async (ctx) => {
                        // @ts-ignore
                        app.$hblBus.$emit('onResponseError', { data: ctx })
                    }
                }
            )

            // Client side only, because setSessionToken saves token as a cookie
            if (process.client) {
                for(let entry of response.headers.entries()) {
                    if (entry[0] === 'sw-context-token' && entry[1] != null) {
                        setSessionToken(entry[1])
                    }
                }
            }

            // @ts-ignore
            resolve(response._data)
        } catch (e) {
            reject(catchErrorCodes(options, e))
        }
    })
};
