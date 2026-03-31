import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type ReviewTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRows?: number;
};

const resizeTextarea = (element: HTMLTextAreaElement) => {
  element.style.height = "0px";
  element.style.height = `${element.scrollHeight}px`;
};

export const ReviewTextarea = ({
  minRows = 3,
  onChange,
  value,
  ...props
}: ReviewTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (!textareaRef.current) {
      return;
    }

    resizeTextarea(textareaRef.current);
  }, [value, minRows]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={minRows}
      value={value}
      onChange={(event) => {
        resizeTextarea(event.currentTarget);
        onChange?.(event);
      }}
    />
  );
};
