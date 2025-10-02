import React from "react";


interface PropInterface {
    data: any
}


export const CommonDetail = ({data}: PropInterface) => {
    if(!data) return <p className={"sm:bg-white p-4 my-2"}>
        No Info
    </p>
    return (
                <p className={"sm:bg-white p-4 my-2"}>
                    {
                        Object.keys(data).map((item, index) => {
                            // @ts-ignore
                            if (['string','number','boolean'].includes(typeof data[item])) {
                                // @ts-ignore
                                let value = data[item];
                                if(typeof value == 'boolean')  value=value?"TRUE":"FALSE"
                                return <div key={index}>
                                    <div className={"flex my-2"}>
                                        <p className={"flex-1 font-bold"}>
                                            {item.toUpperCase()}
                                        </p>
                                        <p className={"flex-1"}>
                                            {value}
                                        </p>
                                    </div>
                                </div>
                            }
                            else{
                                return <></>
                            }
                        })
                    }
                </p>
    );
}
