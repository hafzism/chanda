import { AuthForm } from '../../components/auth/auth-form';
import { AuthLayout } from '../../components/auth/auth-layout';

export default function SignInPage() {
  return (
    <AuthLayout>
      <AuthForm mode="sign-in" />
    </AuthLayout>
  );
}
