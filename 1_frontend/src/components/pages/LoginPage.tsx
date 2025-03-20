import { Box } from "@mui/system"
import AuthSignIn from "../autentication/AuthSignIn"

function LoginPage() {
  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'var(--neutralLighterAlt)' }}>
      <div className="box">
        <div className="box-item">
          <AuthSignIn />
        </div>
      </div>
    </Box>
  )
}

export default LoginPage