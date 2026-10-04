"use client";

import { Flex, Typography } from "antd";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  extra,
}: {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <Flex justify="space-between" align="flex-start" gap={16} wrap style={{ marginBottom: 16 }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description && (
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
            {description}
          </Typography.Text>
        )}
      </div>
      {extra && <Flex gap={8}>{extra}</Flex>}
    </Flex>
  );
}
