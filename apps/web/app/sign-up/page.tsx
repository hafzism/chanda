import { AuthForm } from '../../components/auth/auth-form';
import { AuthLayout } from '../../components/auth/auth-layout';

export default function SignUpPage() {
  return (
    <AuthLayout>
      <AuthForm mode="sign-up" />
    </AuthLayout>
  );
}
