
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    login();
    navigate("/dashboard");
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2 className="login-title">Haemil ERP</h2>

        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="ID"
            className="login-input"
          />

          <input
            type="password"
            placeholder="Password"
            className="login-input"
          />

          <button type="submit" className="login-button">
            Sign In
          </button>
        </form>

        <p className="login-footer">
          © 2026 Haemil Co., Ltd.
        </p>
      </div>
    </div>
  );
};

export default Login;
