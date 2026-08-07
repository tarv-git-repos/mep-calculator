import React, { useState, useEffect, useRef } from "react";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createRoot } from "react-dom/client";

// Prevent Vite from treeshaking createRoot so it is available for our Tauri CSR patch
if (typeof window !== "undefined" && (window as any).__never_eval_createroot__) {
  createRoot(document.getElementById("tauri-app-root")!);
}

// Global patch to allow backspacing "0" in controlled <input type="number"> elements
const originalCreateElement = React.createElement;

function NumericInput({ value, onChange, ...props }: any) {
  const [localVal, setLocalVal] = useState<string>(
    value === 0 || value === "0" ? "" : String(value ?? "")
  );
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setLocalVal(value === 0 || value === "0" ? "" : String(value ?? ""));
    }
  }, [value]);

  return originalCreateElement("input", {
    ...props,
    ref,
    type: "number",
    value: localVal,
    onChange: (e: any) => {
      const val = e.target.value;
      setLocalVal(val);
      if (onChange) {
        if (val === "") {
          onChange({
            ...e,
            target: { ...e.target, value: "0", valueAsNumber: 0 }
          });
        } else {
          onChange(e);
        }
      }
    },
    onBlur: (e: any) => {
      setLocalVal(value === 0 || value === "0" ? "" : String(value ?? ""));
      if (props.onBlur) {
        props.onBlur(e);
      }
    },
    "data-bypass-patch": true
  });
}

// @ts-ignore
React.createElement = function (type: any, props: any, ...children: any[]) {
  if (
    type === "input" &&
    props &&
    props.type === "number" &&
    !props["data-bypass-patch"] &&
    props.onChange &&
    props.value !== undefined &&
    typeof props.value === "number"
  ) {
    return originalCreateElement(NumericInput, props, ...children);
  }
  return originalCreateElement.apply(this, [type, props, ...children]);
};

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
