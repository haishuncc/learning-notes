import { Layout, Navbar } from "nextra-theme-docs";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: {
    default: "Coding Notes",
    template: "%s | Coding Notes",
  },
  description: "编程学习笔记",
};

const navbar = <Navbar logo={<b>Coding Notes</b>} />;

export default async function RootLayout({ children }) {
  return (
    <html lang="zh-CN" dir="ltr" suppressHydrationWarning>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/haishuncc/learning-notes/tree/main"
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
