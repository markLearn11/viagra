from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database import get_db
from app.models import MBTIResult, User
from app.schemas import (
    MBTISubmission,
    MBTIResultResponse,
    MessageResponse
)

router = APIRouter()

# MBTI测试题目（简化版）
MBTI_QUESTIONS = [
    {
        "id": 1,
        "question": "在聚会中，你更倾向于：",
        "options": [
            {"value": "E", "text": "主动与很多人交谈"},
            {"value": "I", "text": "与少数几个人深入交流"}
        ],
        "dimension": "EI"
    },
    {
        "id": 2,
        "question": "你更相信：",
        "options": [
            {"value": "S", "text": "实际经验和事实"},
            {"value": "N", "text": "直觉和可能性"}
        ],
        "dimension": "SN"
    },
    {
        "id": 3,
        "question": "做决定时，你更看重：",
        "options": [
            {"value": "T", "text": "逻辑分析"},
            {"value": "F", "text": "个人价值观和感受"}
        ],
        "dimension": "TF"
    },
    {
        "id": 4,
        "question": "你更喜欢：",
        "options": [
            {"value": "J", "text": "有计划和结构的生活"},
            {"value": "P", "text": "灵活和自发的生活"}
        ],
        "dimension": "JP"
    },
    {
        "id": 5,
        "question": "你的能量来源主要是：",
        "options": [
            {"value": "E", "text": "与他人互动"},
            {"value": "I", "text": "独处和内省"}
        ],
        "dimension": "EI"
    },
    {
        "id": 6,
        "question": "你更关注：",
        "options": [
            {"value": "S", "text": "具体的细节"},
            {"value": "N", "text": "整体的概念"}
        ],
        "dimension": "SN"
    },
    {
        "id": 7,
        "question": "批评别人时，你更倾向于：",
        "options": [
            {"value": "T", "text": "直接指出问题"},
            {"value": "F", "text": "考虑对方的感受"}
        ],
        "dimension": "TF"
    },
    {
        "id": 8,
        "question": "你更喜欢：",
        "options": [
            {"value": "J", "text": "按时完成任务"},
            {"value": "P", "text": "在截止日期前灵活安排"}
        ],
        "dimension": "JP"
    }
]

# MBTI类型描述
MBTI_DESCRIPTIONS = {
    "INTJ": "建筑师 - 富有想象力和战略性的思想家，一切皆在计划之中。",
    "INTP": "逻辑学家 - 具有创造性的发明家，对知识有着止不住的渴望。",
    "ENTJ": "指挥官 - 大胆，富有想象力，意志强烈的领导者。",
    "ENTP": "辩论家 - 聪明好奇的思想家，不会放弃任何智力挑战。",
    "INFJ": "提倡者 - 安静而神秘，同时鼓舞人心且不知疲倦的理想主义者。",
    "INFP": "调停者 - 诗意，善良的利他主义者，总是热心为正义而奋斗。",
    "ENFJ": "主人公 - 富有魅力鼓舞人心的领导者，有着感化他人的能力。",
    "ENFP": "竞选者 - 热情，有创造力，社交能力强，总是能找到笑容的理由。",
    "ISTJ": "物流师 - 实用主义的逻辑学家，可靠性无人能及。",
    "ISFJ": "守护者 - 非常专注而温暖的守护者，时刻准备着保护爱着的人们。",
    "ESTJ": "总经理 - 出色的管理者，在管理事情或人的时候无与伦比。",
    "ESFJ": "执政官 - 极有同情心，善于交际，受人欢迎，总是热心帮助他人。",
    "ISTP": "鉴赏家 - 大胆而实际的实验家，擅长使用各种工具。",
    "ISFP": "探险家 - 灵活有魅力的艺术家，时刻准备着探索新的可能性。",
    "ESTP": "企业家 - 聪明，精力充沛，非常善于感知，真正享受生活在边缘的感觉。",
    "ESFP": "表演者 - 自发的，精力充沛，热情的表演者，生活对他们来说绝不无聊。"
}

def calculate_mbti_type(answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    根据答题结果计算MBTI类型
    """
    scores = {"E": 0, "I": 0, "S": 0, "N": 0, "T": 0, "F": 0, "J": 0, "P": 0}
    
    # 统计各维度得分
    for answer in answers:
        answer_value = answer["answer"]
        scores[answer_value] += 1
    
    # 确定每个维度的类型
    ei = "E" if scores["E"] >= scores["I"] else "I"
    sn = "S" if scores["S"] >= scores["N"] else "N"
    tf = "T" if scores["T"] >= scores["F"] else "F"
    jp = "J" if scores["J"] >= scores["P"] else "P"
    
    mbti_type = ei + sn + tf + jp
    
    return {
        "type": mbti_type,
        "scores": scores,
        "description": MBTI_DESCRIPTIONS.get(mbti_type, "未知类型")
    }

@router.get("/questions")
async def get_mbti_questions():
    """
    获取MBTI测试题目
    """
    return {"questions": MBTI_QUESTIONS}

@router.post("/submit", response_model=MBTIResultResponse)
async def submit_mbti_test(
    submission: MBTISubmission,
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    提交MBTI测试答案
    """
    # 检查用户是否存在
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 验证答案数量
    if len(submission.answers) != len(MBTI_QUESTIONS):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="答案数量不正确"
        )
    
    # 计算MBTI类型
    answers_dict = [answer.dict() for answer in submission.answers]
    result = calculate_mbti_type(answers_dict)
    
    # 保存结果
    db_result = MBTIResult(
        user_id=user_id,
        result_type=result["type"],
        answers=answers_dict,
        scores=result["scores"],
        description=result["description"]
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    
    return db_result

@router.get("/results/user/{user_id}", response_model=List[MBTIResultResponse])
async def get_user_mbti_results(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取用户的MBTI测试结果
    """
    results = db.query(MBTIResult).filter(
        MBTIResult.user_id == user_id
    ).order_by(MBTIResult.created_at.desc()).all()
    
    return results

@router.get("/results/{result_id}", response_model=MBTIResultResponse)
async def get_mbti_result(
    result_id: int,
    db: Session = Depends(get_db)
):
    """
    获取特定的MBTI测试结果
    """
    result = db.query(MBTIResult).filter(
        MBTIResult.id == result_id
    ).first()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="测试结果不存在"
        )
    
    return result

@router.delete("/results/{result_id}", response_model=MessageResponse)
async def delete_mbti_result(
    result_id: int,
    db: Session = Depends(get_db)
):
    """
    删除MBTI测试结果
    """
    result = db.query(MBTIResult).filter(
        MBTIResult.id == result_id
    ).first()
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="测试结果不存在"
        )
    
    db.delete(result)
    db.commit()
    
    return MessageResponse(message="测试结果删除成功")