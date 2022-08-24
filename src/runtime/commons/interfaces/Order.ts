import { CustomerBillingAddress, CustomerShippingAddress } from './Customer'
import { ShippingMethod } from './ShippingMethod'
import { PaymentMethod } from './PaymentMethod'
import { LineItem, Totals } from './Cart'
import { Media } from './Media'

export interface OrderLineItem {
    id: string,
    name: string,
    media: Media,
    quantity: number,
    price: number
}

export interface Order {
    id: string,
    email: string,
    shippingAddress: CustomerShippingAddress,
    billingAddress: CustomerBillingAddress,
    shippingMethod: ShippingMethod,
    paymentMethod: PaymentMethod,
    lineItems: OrderLineItem[],
    totals: Totals
}