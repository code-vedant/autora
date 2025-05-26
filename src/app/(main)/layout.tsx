import React from "react";

const MainLayout = ({ children }: {children : React.ReactNode}) => {
  return <div className="container mx-auto mt-8 md:mt-8">{children}</div>;
};

export default MainLayout;