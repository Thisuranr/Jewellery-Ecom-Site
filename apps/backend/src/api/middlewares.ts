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

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
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
