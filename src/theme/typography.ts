export const fontFamily = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
} as const;

export const typography = {
  hero: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 42 },
  screenTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 22,
    lineHeight: 34,
  },
  sectionTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 30,
  },
  title: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 28 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 27 },
  label: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 26 },
  caption: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 24 },
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 28 },
} as const;
