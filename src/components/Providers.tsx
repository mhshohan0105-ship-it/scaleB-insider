"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import enGB from "antd/locale/en_GB";
import { useEffect, type ReactNode } from "react";

export const BRAND_COLOR = "#0e7c6b";

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
          colorPrimary: BRAND_COLOR,
          borderRadius: 6,
          fontFamily:
            "'Segoe UI', system-ui, -apple-system, 'Noto Sans Bengali', Roboto, Helvetica, Arial, sans-serif",
        },
        components: {
          Layout: { siderBg: "#0f2a2e", headerBg: "#ffffff", headerPadding: "0 20px" },
          Menu: {
            darkItemBg: "#0f2a2e",
            darkSubMenuItemBg: "#0b2023",
            darkItemSelectedBg: BRAND_COLOR,
          },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
