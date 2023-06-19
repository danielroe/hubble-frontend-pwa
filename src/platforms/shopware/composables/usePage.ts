import { Ref, ref } from 'vue'
import { RouteLocationNormalizedLoaded } from 'vue-router'
import { useRouter } from '#app'
import {
    HblIUsePage,
    HblPage,
    HblProduct,
    HblProductListing,
    HblProductListingFilterCurrent
} from '@/utils/types'
import { hblUseDefaultStructure } from '@/utils/helper'
import {
    ProductShopware,
    PwaShopware,
    OpenAPI,
    PropertyGroup,
    Product as swProduct
} from '@hubblecommerce/hubble/platforms/shopware/api-client'
import { request as __request } from '@hubblecommerce/hubble/platforms/shopware/request'
import { useLocalisation, useRuntimeConfig, hblMapPage, hblMapProductListing, hblMapProduct } from '#imports'

const associations = {
    media: {},
    manufacturer: {
        associations: {
            media: {}
        }
    }
}

export const usePage = function (): HblIUsePage {
    const loading: Ref<boolean> = ref(false)
    const error: Ref = ref(false)
    const page: Ref<HblPage | null> = ref(null)
    const runtimeConfig = useRuntimeConfig()
    const { currentRoute } = useRouter()
    const { isLocalisedRoute } = useLocalisation()

    const getPage = async (route: RouteLocationNormalizedLoaded): Promise<HblPage> => {
        try {
            loading.value = true
            error.value = false

            let path = route.path
            const params = parseParamsFromQuery(route)

            // Remove localisation from route
            const routeLocale = isLocalisedRoute(path)
            if (routeLocale) {
                path = path.replace('/' + routeLocale, '')
            }

            const requestBody = {
                associations,
                path,
                ...params
            }

            const response = await PwaShopware.pwaResolvePage(requestBody)

            const mappedPage = hblMapPage(response)

            if (mappedPage.structure === null) {
                const { setDefaultStructures, getDefaultStructureByType } = hblUseDefaultStructure()
                setDefaultStructures()
                mappedPage.structure = getDefaultStructureByType(mappedPage.type)
            }

            loading.value = false
            return mappedPage
        } catch (e) {
            loading.value = false
            error.value = e
            throw e
        }
    }

    async function getProductListing (filters: HblProductListingFilterCurrent, limit: number, sort: string, page?: number): Promise<{ productListing: HblProductListing, params: Record<string, unknown> }> {
        try {
            loading.value = true
            error.value = false

            const { navigationId, search, manufacturer, price, rating, 'shipping-free': shipping, ...properties } = filters

            const cleanedProps: any[] = []
            Object.keys(properties).forEach((key) => {
                // @ts-ignore
                properties[key].forEach((property) => {
                    if (property !== '') {
                        cleanedProps.push(property)
                    }
                })
            })

            const params = {
                order: sort,
                limit,
                ...(search != null && { search }),
                ...(page != null && { p: page }),
                // @ts-ignore
                ...(manufacturer?.length > 0 && { manufacturer }),
                // @ts-ignore
                ...(price?.min !== '' && { 'min-price': price.min }),
                // @ts-ignore
                ...(price?.max !== '' && { 'max-price': price.max }),
                // @ts-ignore
                ...(rating?.min !== '' && { rating: rating.min }),
                ...(shipping != null && { 'shipping-free': shipping }),
                ...(cleanedProps.length > 0 && { properties: cleanedProps })
            }

            const requestBody = {
                associations,
                ...params
            }

            let response

            if (navigationId) {
                response = await ProductShopware.readProductListing(
                    navigationId as string,
                    // TODO Patch api
                    // @ts-ignore
                    requestBody
                )
            } else {
                response = await ProductShopware.searchPage(
                    // TODO Patch api
                    // @ts-ignore
                    requestBody
                )
            }

            const mappedListing = hblMapProductListing(response)

            loading.value = false
            return { productListing: mappedListing, params }
        } catch (e) {
            loading.value = false
            error.value = e
            throw e
        }
    }

    // Write parameters to current url without reloading the page
    function updateUri (params: any): void {
        const url = new URL(runtimeConfig.public.appBaseUrl + currentRoute.value.path)
        url.search = new URLSearchParams(params).toString()
        window.history.pushState(
            {},
            '',
            url.href
        )
    }

    async function getProductVariant (parentId: string, selectedOptions: Record<string, string>, switchedOption: string, switchedGroup: string): Promise<HblProduct | void> {
        loading.value = true
        error.value = false

        try {
            let options: any = []
            Object.keys(selectedOptions).forEach((key) => {
                options.push(selectedOptions[key])
            })

            // Set selected option to end of array, to force shopware to respond with a matching variant
            // even the selected option is not available
            options.push(options.splice(options.indexOf(switchedOption), 1)[0]);

            const matchingVariant = await ProductShopware.searchProductVariantIds(parentId, {
                options,
                switchedGroup
            })

            // @ts-ignore
            if (matchingVariant?.variantId == null) {
                loading.value = false
                // @ts-ignore
                error.value = 'No matching variant found'
                return
            }

            const response = await __request(OpenAPI, {
                method: "POST",
                url: "/product/{productId}",
                path: {
                    // @ts-ignore
                    "productId": matchingVariant?.variantId
                },
                body: {
                    associations: {
                        ...associations,
                        crossSellings: {},
                    }
                }
            }) as { product: swProduct, configurator: Array<PropertyGroup> }

            if (response.product == null) {
                loading.value = false
                // @ts-ignore
                error.value = 'No matching variant found'
                return
            }

            loading.value = false
            return hblMapProduct(response.product, response.configurator)
        } catch (e) {
            loading.value = false
            error.value = e
        }
    }

    function parseParamsFromQuery (route: RouteLocationNormalizedLoaded): any {
        const {
            order,
            limit,
            p,
            manufacturer,
            'min-price': minPrice,
            'max-price': maxPrice,
            rating,
            'shipping-free': shipping,
            properties,
            search,
            ...unknown
        } = route.query

        return {
            ...(order != null && { order }),
            ...(limit != null && typeof limit === 'string' && { limit: parseInt(limit) }),
            ...(p != null && { p }),
            ...(manufacturer != null && typeof manufacturer === 'string' && { manufacturer: manufacturer.split(',') }),
            ...(minPrice != null && { 'min-price': minPrice }),
            ...(maxPrice != null && { 'max-price': maxPrice }),
            ...(rating != null && { rating }),
            ...(shipping != null && { 'shipping-free': (shipping === 'true') }),
            ...(properties != null && typeof properties === 'string' && { properties: properties.split(',') }),
            ...(search != null && { search })
        }
    }

    return {
        loading,
        error,
        getPage,
        page,
        getProductListing,
        updateUri,
        getProductVariant,
        parseParamsFromQuery
    }
}
