import {useContext, useEffect} from "react";
import {AppContext} from "../../../contexts/AppContext";
import {LaunchItem} from "./LaunchItem";
import {Footer} from "../Footer";

export const Launches = () => {
    const {launches, getLaunches, isLaunchLoading} = useContext(AppContext)

    const handleLoadMore = () => {
        getLaunches({options: {page: launches.page + 1}})
    }

    const items = launches.data.map((item, index) => {
        return <LaunchItem item={item} key={index}/>
    })

    useEffect(() => {
       if(!launches.data.length){
           getLaunches({options: {page: 1, limit: 10}})
       }
       // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className={"mx-2 m-2 block"}>
            <h1 className={"font-bold bg-red-500 rounded text-white text-center text-lg"}>Launches-{launches.data.length}</h1>
            <div className={"bg-gray-100 overflow-scroll content-height"}>
                {items}
            </div>
            <Footer loading={isLaunchLoading}
                    handleLoadMore={handleLoadMore}
                    data={launches.data}
                    total={launches.totalDocs}/>
        </div>
    );
}
