import React, {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import axios from "axios";
import {CommonDetail} from "../ShowCommonInfo";

export const LaunchDetail = () => {
    const {id} = useParams<{ id?: string }>();
    const [detail, setDetail] = useState<any | undefined>(undefined);


    useEffect(() => {
        const fetchDetail = async () => {
            await axios.get(`https://api.spacexdata.com/v4/launches/${id}`).then(res => {
                console.log('res.data', res.data);
                setDetail(res.data)
            })
        }
        fetchDetail()
    }, [id])

    if (!detail) {
        return <h1 className="text-center my-4 font-bold text-lg">Loading Details</h1>
    }

    const Failures = () => {
        if (!detail.failures) return <></>
        return <>
            <p className="my-4 font-bold text-lg">Failures</p>
            {
                detail.failures.map((item: Object, index: number) => {
                    return <CommonDetail key={index} data={item}/>
                })
            }
        </>
    }

    return <div className="my-5">
        <h1 className="text-center my-4 font-bold text-lg">Launch Detail</h1>
        <div className="mx-5 bg-gray-200 p-5">
            <h1 className="text-center my-4 font-bold text-lg">Rocket Detail</h1>
            <p className="my-4 font-bold text-lg">Links</p>
            <CommonDetail data={detail.links}/>
            <p className="my-4 font-bold text-lg">Detail</p>
            <CommonDetail data={detail}/>
            <p className="my-4 font-bold text-lg">Cores</p>
            {
                detail.cores.map((item: Object, index: number) => {
                    return <CommonDetail key={index} data={item}/>
                })
            }
            <Failures/>
            <p className="my-4 font-bold text-lg">Fairings</p>
            <CommonDetail data={detail.fairings}/>

        </div>
    </div>
}
