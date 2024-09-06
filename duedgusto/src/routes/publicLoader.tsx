import { isAuthenticated } from '../common/authentication/auth';
import { redirect } from 'react-router-dom';

function publicLoader() {
  if (isAuthenticated()) {
    return redirect("/amico4forweb");
  }
  return null;
}

export default publicLoader