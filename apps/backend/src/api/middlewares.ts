import {
  configureStoreSearch,
  defineMiddlewares,
  validateAndTransformBody,
} from '@medusajs/framework/http'
import {
  AdminCreateAttributeSchema,
  AdminOptionInputSchema,
  AdminSetAttributeCategoriesSchema,
  AdminSetProductAttributesSchema,
  AdminUpdateAttributeSchema,
} from './admin/attributes/validators'
import {
  AdminUpdateEnquirySchema,
  StoreCreateEnquirySchema,
} from '../modules/custom-enquiry/lib/rules'
import { stripPaymentSessionData } from '../lib/sanitize-payment-session-body'
import {
  forceTaxInclusiveOnCreate,
  forceTaxInclusiveOnUpdate,
} from '../lib/force-tax-inclusive-promotion'

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    // Never let a shopper pass PaymentIntent overrides (capture_method, confirm, ...) to Stripe.
    {
      method: ['POST'],
      matcher: '/store/payment-collections/:id/payment-sessions',
      middlewares: [stripPaymentSessionData],
    },
    // All prices include GST, so promotions must be tax-inclusive ("$10 off"
    // means $10 off the GST-inclusive price, not $11).
    {
      method: ['POST'],
      matcher: '/admin/promotions',
      middlewares: [forceTaxInclusiveOnCreate],
    },
    {
      method: ['POST'],
      matcher: '/admin/promotions/:id',
      middlewares: [forceTaxInclusiveOnUpdate],
    },
    // Custom order enquiries (storefront form, and the admin status change).
    {
      method: ['POST'],
      matcher: '/store/custom-enquiries',
      middlewares: [validateAndTransformBody(StoreCreateEnquirySchema)],
    },
    {
      method: ['POST'],
      matcher: '/admin/custom-enquiries/:id',
      middlewares: [validateAndTransformBody(AdminUpdateEnquirySchema)],
    },
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    // Product attributes admin API.
    {
      method: ['POST'],
      matcher: '/admin/attributes',
      middlewares: [validateAndTransformBody(AdminCreateAttributeSchema)],
    },
    {
      method: ['POST'],
      matcher: '/admin/attributes/:id',
      middlewares: [validateAndTransformBody(AdminUpdateAttributeSchema)],
    },
    {
      method: ['POST'],
      matcher: '/admin/attributes/:id/options',
      middlewares: [validateAndTransformBody(AdminOptionInputSchema)],
    },
    {
      method: ['POST'],
      matcher: '/admin/attributes/:id/options/:option_id',
      middlewares: [validateAndTransformBody(AdminOptionInputSchema)],
    },
    {
      method: ['POST'],
      matcher: '/admin/attributes/:id/categories',
      middlewares: [validateAndTransformBody(AdminSetAttributeCategoriesSchema)],
    },
    {
      method: ['POST'],
      matcher: '/admin/products/:id/attributes',
      middlewares: [validateAndTransformBody(AdminSetProductAttributesSchema)],
    },
  ],
})
