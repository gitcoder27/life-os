import { RouterProvider } from "react-router-dom";

import { router } from "./router";
import { useReleaseRefresh } from "./useReleaseRefresh";

export function App() {
  useReleaseRefresh();

  return <RouterProvider router={router} />;
}
