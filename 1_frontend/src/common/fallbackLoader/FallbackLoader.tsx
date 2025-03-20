import { CircularProgress } from "@mui/material";

const FallbackLoader = (
  <div className="box" style={{ height: 'calc(100vh - 88px)' }}>
    <CircularProgress />
  </div>
);

export default FallbackLoader;
