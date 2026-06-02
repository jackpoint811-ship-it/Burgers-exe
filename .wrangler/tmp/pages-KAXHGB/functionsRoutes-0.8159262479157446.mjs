import { onRequest as __api_bank_config_js_onRequest } from "/workspaces/Burgers-exe/cloudflare/public-order/functions/api/bank-config.js"
import { onRequest as __api_menu_js_onRequest } from "/workspaces/Burgers-exe/cloudflare/public-order/functions/api/menu.js"
import { onRequest as __api_order_js_onRequest } from "/workspaces/Burgers-exe/cloudflare/public-order/functions/api/order.js"
import { onRequest as __api_order_gate_js_onRequest } from "/workspaces/Burgers-exe/cloudflare/public-order/functions/api/order-gate.js"

export const routes = [
    {
      routePath: "/api/bank-config",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_bank_config_js_onRequest],
    },
  {
      routePath: "/api/menu",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_menu_js_onRequest],
    },
  {
      routePath: "/api/order",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_order_js_onRequest],
    },
  {
      routePath: "/api/order-gate",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_order_gate_js_onRequest],
    },
  ]