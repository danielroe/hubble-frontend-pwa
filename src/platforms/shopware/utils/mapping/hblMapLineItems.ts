import { LineItem as SwLineItem } from '@hubblecommerce/hubble/platforms/shopware/api-client'
import { HblLineItem } from '@/utils/types'
import { hblMapLineItem } from '#imports'

export function hblMapLineItems (lineItems: SwLineItem[]): HblLineItem[] {
    return lineItems.map((lineItem) => {
        return hblMapLineItem(lineItem)
    })
}
