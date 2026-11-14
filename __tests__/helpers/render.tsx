import { render as nativeRender } from '@testing-library/react-native';
import { AppThemeProvider } from '../../src/theme/ThemeProvider';
export * from '@testing-library/react-native';
export const render: typeof nativeRender = (element, options) => {
  const Wrapper = options?.wrapper;
  return nativeRender(element, {
    ...options,
    wrapper: ({ children }) => (
      <AppThemeProvider>
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </AppThemeProvider>
    ),
  });
};
