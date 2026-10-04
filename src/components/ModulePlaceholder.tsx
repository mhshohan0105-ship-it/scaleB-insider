"use client";

import { Card, Result, Tag } from "antd";

interface ModulePlaceholderProps {
  moduleLabel: string;
  pageLabel: string;
  phase: number;
}

/** Stand-in for pages that later build phases will deliver. */
export function ModulePlaceholder({ moduleLabel, pageLabel, phase }: ModulePlaceholderProps) {
  return (
    <Card>
      <Result
        status="info"
        title={pageLabel}
        subTitle={
          <>
            {moduleLabel !== pageLabel && <div>{moduleLabel}</div>}
            <div style={{ marginTop: 8 }}>
              This page is scheduled for <Tag color="processing">Phase {phase}</Tag>
            </div>
          </>
        }
      />
    </Card>
  );
}

export function AccessDenied() {
  return (
    <Card>
      <Result
        status="403"
        title="No access"
        subTitle="Your role does not include this page. Ask the agency owner if you need it."
      />
    </Card>
  );
}
