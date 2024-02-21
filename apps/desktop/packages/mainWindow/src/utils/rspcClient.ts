import { QueryClient } from "@tanstack/solid-query";
import {
  createClient,
  createWSClient,
  Unsubscribable,
  wsLink
} from "@rspc/client";
import { createSolidQueryHooks } from "@rspc/solid";
import type { Procedures } from "@gd/core_module";
import { createEffect } from "solid-js";

export const rspc = createSolidQueryHooks<Procedures>();
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // default: true
      networkMode: "always"
    },
    mutations: {
      networkMode: "always"
    }
  }
});

export let port: number | null = null;

export default function initRspc(_port: number) {
  port = _port;
  const wsClient = createWSClient({
    url: `ws://127.0.0.1:${_port}/rspc/ws`
  });

  const client = createClient<Procedures>({
    links: [
      wsLink({
        client: wsClient
      })
    ]
  });

  const createInvalidateQuery = () => {
    const context = rspc.useContext();
    let subscription: Unsubscribable | null = null;

    function init() {
      if (!subscription) {
        subscription = client.subscription(["invalidateQuery"], {
          onData: (invalidateOperation) => {
            const key = [invalidateOperation!.key];
            if (invalidateOperation.args !== null) {
              key.push(invalidateOperation.args);
            }
            console.log("invalidateQuery", key);
            context.queryClient.invalidateQueries(key);
          }
        });
      }
    }

    wsClient.getConnection()?.addEventListener("open", (_event) => {
      init();
    });

    wsClient.getConnection()?.addEventListener("close", (_event) => {
      subscription?.unsubscribe();
      subscription = null;
    });

    if (!subscription) {
      init();
    }
  };

  return {
    client,
    createInvalidateQuery
  };
}

export async function rspcFetch(...args: any[]) {
  // using .apply to avoid typescript error
  const res = rspc.createQuery.apply(null, args as any);

  return new Promise((resolve, reject) => {
    createEffect(() => {
      if (res.error) {
        reject(res);
      } else if (res.status === "success") {
        resolve(res);
      }
    });
  });
}
