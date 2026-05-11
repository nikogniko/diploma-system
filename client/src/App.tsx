import { RouterProvider } from "react-router-dom";
import { router } from "./router";

function App() {
  return (
    // ClerkProvider у нас в main.tsx, тому тут тільки роутер
    <RouterProvider router={router} />
  );
}

export default App;
