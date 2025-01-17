import { OrderLineItem as SwOrderLineItem } from '@hubblecommerce/hubble/platforms/shopware/api-client'
import { HblOrderLineItem } from '@/utils/types'
import { hblMapMedia, hblMapOrderLineItemDownloads } from '#imports'

export function hblMapOrderLineItem (swOrderLineItem: SwOrderLineItem): HblOrderLineItem {
    return {
        // @ts-ignore
        id: swOrderLineItem.id,
        name: swOrderLineItem.label,
        // @ts-ignore
        media: hblMapMedia(swOrderLineItem.cover),
        quantity: swOrderLineItem.quantity,
        // @ts-ignore
        price: swOrderLineItem.totalPrice,
        ...(swOrderLineItem?.downloads?.length > 0 && { downloads: hblMapOrderLineItemDownloads(swOrderLineItem.downloads) })
    }
}
