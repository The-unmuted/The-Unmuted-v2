/**
 * Pre-set SOS message template — stored in localStorage.
 * The placeholder {位置} is replaced with GPS coordinates (decimal degrees) at trigger time.
 * Recipients can paste the coordinates into any map app (Gaode, Baidu, Apple Maps, etc.)
 */
import { useState, useCallback } from "react";

const STORAGE_KEY = "unmuted_sos_message";

export const DEFAULT_TEMPLATE =
  `我需要帮助，现在处境不安全。\n位置：\n{位置}\n请立即联系我，5分钟内无回应请代我报警。\nI need help and I am not safe.\nLocation:\n{位置}\nCall me back. If no answer in 5 min, call police for me.`;

export function loadSosTemplate(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

export function useSosMessage() {
  const [template, setTemplateState] = useState<string>(loadSosTemplate);

  const setTemplate = useCallback((text: string) => {
    setTemplateState(text);
    localStorage.setItem(STORAGE_KEY, text);
  }, []);

  const reset = useCallback(() => {
    setTemplateState(DEFAULT_TEMPLATE);
    localStorage.setItem(STORAGE_KEY, DEFAULT_TEMPLATE);
  }, []);

  return { template, setTemplate, reset };
}
