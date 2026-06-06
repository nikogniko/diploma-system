import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { legacyHtmlToMarkdown } from "../../utils/richText";
import classes from "./MarkdownView.module.scss";

type MarkdownViewProps = {
  value: string;
  className?: string;
};

export function MarkdownView({ value, className }: MarkdownViewProps) {
  return (
    <div className={`${classes.markdown} ${className ?? ""}`}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {legacyHtmlToMarkdown(value)}
      </ReactMarkdown>
    </div>
  );
}
