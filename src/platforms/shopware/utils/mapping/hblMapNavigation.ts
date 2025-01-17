import { NavigationRouteResponse } from '@hubblecommerce/hubble/platforms/shopware/api-client'
import { HblNavigation } from '@/utils/types'

export function hblMapNavigation (swNavigation: NavigationRouteResponse): HblNavigation {
    // @ts-ignore
    return swNavigation.map((item) => {
        let children: HblNavigation = []
        if (item.childCount != null && item.childCount > 0) {
            // @ts-ignore
            children = hblMapNavigation(item.children)
        }

        let url = null
        // @ts-ignore
        if (item.seoUrls.length > 0) {
            // @ts-ignore
            if (item.seoUrls[0].seoPathInfo !== undefined) {
                // @ts-ignore
                url = '/' + item.seoUrls[0].seoPathInfo
            }
        }

        return {
            id: item.id,
            name: item.translated.name,
            url,
            children
        }
    })
}
