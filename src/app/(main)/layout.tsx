import React from "react";

const MainLayout = ({ children }: {children : React.ReactNode}) => {
  return <div className="container mx-auto pt-3">{children}</div>;
};

export default MainLayout;