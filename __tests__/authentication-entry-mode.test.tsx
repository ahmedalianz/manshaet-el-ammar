import { beforeEach, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from './helpers/render';
import SignIn from '../src/app/provider/sign-in';
let mockMode = 'sign-in';
const mockSignIn = jest.fn<(...args: string[]) => Promise<void>>();
const mockRegister = jest.fn<(...args: string[]) => Promise<void>>();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ mode: mockMode }),
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));
jest.mock('../src/features/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    initializing: false,
    configured: true,
    signIn: mockSignIn,
    register: mockRegister,
    signInGoogle: jest.fn(),
  }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  mockSignIn.mockResolvedValue(undefined);
  mockRegister.mockResolvedValue(undefined);
});
it.each(['register', 'sign-in'])(
  'opens and submits the matching %s form',
  async (mode) => {
    mockMode = mode;
    await render(<SignIn />);
    if (mode === 'register')
      await fireEvent.changeText(screen.getByLabelText('الاسم'), 'أحمد');
    else expect(screen.queryByLabelText('الاسم')).toBeNull();
    await fireEvent.changeText(
      screen.getByLabelText('البريد الإلكتروني'),
      'resident@example.com',
    );
    await fireEvent.changeText(
      screen.getByLabelText('كلمة المرور'),
      'example-password',
    );
    await fireEvent.press(
      screen.getByRole('button', {
        name: mode === 'register' ? 'إنشاء حساب' : 'تسجيل الدخول',
      }),
    );
    if (mode === 'register') {
      expect(mockRegister).toHaveBeenCalledWith(
        'أحمد',
        'resident@example.com',
        'example-password',
      );
      expect(mockSignIn).not.toHaveBeenCalled();
    } else {
      expect(mockSignIn).toHaveBeenCalledWith(
        'resident@example.com',
        'example-password',
      );
      expect(mockRegister).not.toHaveBeenCalled();
    }
  },
);
