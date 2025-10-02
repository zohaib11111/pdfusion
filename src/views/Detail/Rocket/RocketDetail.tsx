import React, {useEffect, useState} from "react";
import {
    useParams
} from "react-router-dom";
import axios from "axios";
import {PayloadWeightInfo} from "./PayloadWeight";
import {FlickerImages} from "./FlickerImages";
import {Stages} from "./Stage";
import {CommonDetail} from "../ShowCommonInfo";

export const RocketDetail = () => {
    const {id} = useParams<{ id?: string }>();
    const [detail, setDetail] = useState<any | undefined>(undefined);

    useEffect(() => {
        const fetchDetail = async () => {
            await axios.get(`https://api.spacexdata.com/v4/rockets/${id}`).then(res => {
                setDetail(res.data)
            }).finally(() => {
            })
        }
        fetchDetail()
    }, [id])
    if (!detail) return <h1 className="text-center my-4 font-bold text-lg">Loading Details</h1>
    let stages = [];
    if (detail.first_stage) stages.push(detail.first_stage)
    if (detail.second_stage) stages.push(detail.first_stage)
    return (
        <div className="my-5">
            <h1 className="text-center my-4 font-bold text-lg">Rocket Detail</h1>
            <div className="mx-5 bg-gray-200 p-5">
                <p className="block mt-1 text-lg leading-tight font-medium">Details</p>
                <CommonDetail data={detail}/>
                <p className="block mt-1 text-lg leading-tight font-medium">Landing Legs</p>
                <CommonDetail data={detail.landing_legs}/>
                <p className="block mt-1 text-lg leading-tight font-medium">Engines</p>
                <CommonDetail data={detail.engines}/>
                <FlickerImages data={detail.flickr_images}/>
                <PayloadWeightInfo data={detail.payload_weights}/>
                <Stages data={[detail.first_stage, detail.second_stage]}/>
            </div>
        </div>
    );
}
