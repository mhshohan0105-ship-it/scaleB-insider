"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import enGB from "antd/locale/en_GB";
import { useEffect, type ReactNode } from "react";

/**
 * scaleB design tokens: one teal accent, warm-neutral greys, status colours
 * that differ in lightness as well as hue. Shared by the app and the PDFs.
 */
export const THEME = {
  brand: "#0f6b5c",
  brandDark: "#0b5246",
  brandSoft: "#e6f2ef",
  sider: "#0c3b34",
  siderHover: "#13493f",
  siderActive: "#1d5a4f",
  ink: "#18211f",
  muted: "#4a5a56",
  line: "#e3e9e7",
  field: "#d5dfdc",
  canvas: "#f3f6f5",
  success: "#067647",
  warning: "#b54708",
  danger: "#b42318",
} as const;

export const BRAND_COLOR = THEME.brand;

export function Providers({ children }: { children: ReactNode }) {
  // Marks the page as interactive (used by end-to-end tests to avoid clicking
  // buttons before React has attached their handlers).
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  return (
    <ConfigProvider
      locale={enGB}
      theme={{
        token: {
          colorPrimary: THEME.brand,
          colorLink: THEME.brand,
          colorSuccess: THEME.success,
          colorWarning: THEME.warning,
          colorError: THEME.danger,
          colorText: THEME.ink,
          colorTextSecondary: THEME.muted,
          colorTextDescription: THEME.muted,
          colorBorder: THEME.field,
          colorBorderSecondary: THEME.line,
          colorBgLayout: THEME.canvas,
          borderRadius: 8,
          borderRadiusLG: 12,
          controlHeight: 38,
          fontSize: 14,
          fontFamily:
            "var(--font-inter), 'Noto Sans Bengali', 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif",
        },
        components: {
          Layout: { siderBg: THEME.sider, headerBg: "#ffffff", headerPadding: "0 24px", headerHeight: 64 },
          Menu: {
            darkItemBg: THEME.sider,
            darkSubMenuItemBg: "#08302a",
            darkItemSelectedBg: THEME.siderActive,
            darkItemHoverBg: THEME.siderHover,
            darkItemColor: "#c9dcd7",
            itemBorderRadius: 8,
            itemMarginInline: 10,
          },
          Button: { fontWeight: 600, primaryShadow: "none", defaultShadow: "none" },
          Card: { headerFontSize: 16, paddingLG: 20 },
          Table: { headerBg: "#fbfcfc", headerColor: THEME.muted, rowHoverBg: "#f8fbfa" },
          Tag: { borderRadiusSM: 12 },
          Form: { labelColor: THEME.muted, verticalLabelPadding: "0 0 6px" },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
