import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HeartHandshake } from "lucide-react";
import ShadTooltip from "./shad-tooltip";
import Markdown from "react-markdown";

export default function Credits() {
  const markdown = `
### Inspiration & Credit

This project was inspired by **GitStory**, created by **Pankaj Kumar**.

While this implementation was built independently from scratch, parts of the idea and direction were inspired by his work.

Check out the [original project](https://gitstory.pankajk.tech/) and the [repository](https://github.com/pankajkumardev/gitstory-2025).
`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div>
          <ShadTooltip content="Credits">
            <Button variant="outline" size="icon">
              <HeartHandshake />
            </Button>
          </ShadTooltip>
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Credits</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 max-h-[400px] overflow-y-auto p-4">
          <Markdown
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80 transition-colors"
                >
                  {children}
                </a>
              ),
            }}
          >
            {markdown}
          </Markdown>
        </div>
      </DialogContent>
    </Dialog>
  );
}
