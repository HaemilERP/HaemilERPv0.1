import { AuthProvider } from "./context/AuthContext";
import Router from "./routes/Router";

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
