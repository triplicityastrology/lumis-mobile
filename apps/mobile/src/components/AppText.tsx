import { Text, type TextProps } from "react-native";

import { MAX_FONT_SCALE, type, type TypeRole } from "../theme/typography";

/**
 * Shared text primitive for the Codex typography system. Applies one semantic
 * role (`variant`) from `theme/typography` and the Dynamic-Type cap (130%). Pass
 * `style` to override colour/alignment; never override fontFamily/size ad hoc.
 * (`variant`, not `role`, because RN's TextProps already reserves `role` for
 * accessibility.)
 */
interface AppTextProps extends TextProps {
  variant: TypeRole;
}

export function AppText(props: AppTextProps) {
  const { variant, style, maxFontSizeMultiplier, ...rest } = props;
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_FONT_SCALE}
      style={[type[variant], style]}
    />
  );
}
