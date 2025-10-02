import {useContext, useEffect} from "react";
import {AppContext} from "../../../contexts/AppContext";
import {RocketItem} from "./RocketItem";
import {Footer} from "../Footer";
import {Redirect} from 'react-router-dom';
export const Rockets = () => {
    const {rockets, getRockets, isRocketsLoading} = useContext(AppContext)

    const handleLoadMore = () => getRockets({options: {page: rockets.page + 1, limit: 10}})


    const goToDetails = ()=> <Redirect to="/launches"/>

    useEffect(() => {
        if (!rockets.data.length) {
            getRockets({options: {page: 1, limit: 10}})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const items = rockets.data.map((item, index) => {
        return <RocketItem item={item} key={index}/>
    })

    return (
        <div className={"mx-2 m-2 block"} onClick={goToDetails}>
            <h1 className={"font-bold bg-red-500 rounded text-white text-center text-lg"}>Rockets-{rockets.data.length}</h1>
            <div className={"bg-gray-100 overflow-scroll content-height"}>
                {items}
            </div>
            <Footer loading={isRocketsLoading}
                    handleLoadMore={handleLoadMore} data={rockets.data}
                    total={rockets.totalDocs}/>
        </div>
    );
}
