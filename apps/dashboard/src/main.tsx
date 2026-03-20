import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Register } from "./pages/Register";
import { Monitor } from "./pages/Monitor";
import { Wallet } from "./pages/Wallet";
import { Keys } from "./pages/Keys";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "register", Component: Register },
      { path: "monitor", Component: Monitor },
      { path: "wallet", Component: Wallet },
      { path: "keys", Component: Keys },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
